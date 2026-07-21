import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';

// Unité pure : service instancié avec DatabaseService + MissionsService mockés.
// Verrouille les gardes (404 mission, IDOR non-participant, statut invalide,
// conflit P2002) et les effets de bord (applyStatusSideEffects) sur create /
// resolve / findByMission. NB : $transaction est utilisé en STYLE TABLEAU
// (this.db.$transaction([op1, op2])), donc les opérations create/update sont
// bien appelées pour construire le tableau.

const makeDb = () => ({
  missionDispute: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  mission: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn().mockResolvedValue([{ id: 'd1' }, {}]),
});

const p2002 = () => Object.assign(new Error('unique'), { code: 'P2002' });

describe('DisputesService', () => {
  let db: ReturnType<typeof makeDb>;
  let missionsService: { applyStatusSideEffects: jest.Mock };
  let service: DisputesService;

  beforeEach(() => {
    db = makeDb();
    missionsService = {
      applyStatusSideEffects: jest.fn().mockResolvedValue(undefined),
    };
    const githubIssues = {
      createDisputeIssue: jest.fn().mockResolvedValue(undefined),
    };
    const email = {
      sendDisputeOpened: jest.fn(),
      sendDisputeResolved: jest.fn(),
    };
    service = new DisputesService(
      db as never,
      missionsService as never,
      githubIssues as never,
      email as never,
    );
  });

  describe('create', () => {
    const data = { reason: 'DAMAGE', description: 'colis abîmé' } as never;

    it("lève NotFound si la mission n'existe pas", async () => {
      db.mission.findUnique.mockResolvedValue(null);

      await expect(service.create('m1', 'u1', data)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("lève Forbidden si le user n'est ni shipper ni carrier", async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        shipperId: 'shipper',
        carrierId: 'carrier',
        advertisementId: 'ad1',
      });

      await expect(service.create('m1', 'intrus', data)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('lève BadRequest si le statut de la mission est hors {ACCEPTED, IN_TRANSIT}', async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'DELIVERED',
        shipperId: 'u1',
        carrierId: 'carrier',
        advertisementId: 'ad1',
      });

      await expect(service.create('m1', 'u1', data)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('convertit un conflit P2002 en ConflictException', async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'IN_TRANSIT',
        shipperId: 'u1',
        carrierId: 'carrier',
        advertisementId: 'ad1',
      });
      db.$transaction.mockRejectedValue(p2002());

      await expect(service.create('m1', 'u1', data)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(missionsService.applyStatusSideEffects).not.toHaveBeenCalled();
    });

    it('happy path : ouvre le dispute via $transaction et déclenche les effets DISPUTED', async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        shipperId: 'u1',
        carrierId: 'carrier',
        advertisementId: 'ad1',
      });

      const result = await service.create('m1', 'u1', data);

      expect(db.missionDispute.create).toHaveBeenCalled();
      expect(db.mission.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'DISPUTED' },
      });
      expect(db.$transaction).toHaveBeenCalled();
      expect(missionsService.applyStatusSideEffects).toHaveBeenCalledWith({
        id: 'm1',
        advertisementId: 'ad1',
        status: 'DISPUTED',
      });
      expect(result).toEqual([{ id: 'd1' }, {}]);
    });
  });

  describe('resolve', () => {
    const data = {
      resolution: 'refund',
      missionOutcome: 'CANCELLED',
    } as never;

    it("lève NotFound si le dispute n'existe pas", async () => {
      db.missionDispute.findUnique.mockResolvedValue(null);

      await expect(service.resolve('d1', 'admin', data)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('lève BadRequest si le dispute est déjà RESOLVED', async () => {
      db.missionDispute.findUnique.mockResolvedValue({
        id: 'd1',
        status: 'RESOLVED',
        missionId: 'm1',
        mission: { advertisementId: 'ad1', status: 'DISPUTED' },
      });

      await expect(service.resolve('d1', 'admin', data)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('happy path : met à jour via $transaction et déclenche les effets missionOutcome', async () => {
      db.missionDispute.findUnique.mockResolvedValue({
        id: 'd1',
        status: 'OPEN',
        missionId: 'm1',
        mission: { advertisementId: 'ad1', status: 'DISPUTED' },
      });

      const updated = await service.resolve('d1', 'admin', data);

      expect(db.missionDispute.update).toHaveBeenCalled();
      expect(db.mission.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'CANCELLED' },
      });
      expect(db.$transaction).toHaveBeenCalled();
      expect(missionsService.applyStatusSideEffects).toHaveBeenCalledWith({
        id: 'm1',
        advertisementId: 'ad1',
        status: 'CANCELLED',
      });
      expect(updated).toEqual({ id: 'd1' });
    });
  });

  describe('findByMission', () => {
    it("lève Forbidden si le user n'est pas participant de la mission", async () => {
      db.mission.findFirst.mockResolvedValue(null);

      await expect(
        service.findByMission('m1', 'intrus'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.missionDispute.findUnique).not.toHaveBeenCalled();
    });

    it('renvoie le dispute si le user est participant', async () => {
      db.mission.findFirst.mockResolvedValue({ id: 'm1' });
      db.missionDispute.findUnique.mockResolvedValue({ id: 'd1' });

      const result = await service.findByMission('m1', 'u1');

      expect(db.missionDispute.findUnique).toHaveBeenCalledWith({
        where: { missionId: 'm1' },
      });
      expect(result).toEqual({ id: 'd1' });
    });
  });
});
