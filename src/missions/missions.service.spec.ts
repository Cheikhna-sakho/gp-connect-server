import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MissionsService } from './missions.service';

// Unité pure : service instancié avec DatabaseService + EventEmitter mockés.
// Verrouille les régressions (IDOR create, 404 annonce, removePackage idempotent),
// la machine à états et les effets de bord d'un changement de statut.

const makeDb = () => ({
  mission: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  missionPackage: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  advertisement: { findUnique: jest.fn(), update: jest.fn() },
  package: { count: jest.fn() },
  transaction: { updateMany: jest.fn() },
  conversation: { updateMany: jest.fn(), findMany: jest.fn() },
});

describe('MissionsService', () => {
  let db: ReturnType<typeof makeDb>;
  let emitter: { emit: jest.Mock };
  let service: MissionsService;

  beforeEach(() => {
    db = makeDb();
    emitter = { emit: jest.fn() };
    service = new MissionsService(db as never, emitter as never);
  });

  describe('create', () => {
    const base = { advertisementId: 'ad1', shipperId: 'u1' } as never;

    it("lève NotFound si l'annonce n'existe pas (sans créer la mission)", async () => {
      db.advertisement.findUnique.mockResolvedValue(null);

      await expect(service.create(base)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.mission.create).not.toHaveBeenCalled();
    });

    it("IDOR : lève Forbidden si un colis n'appartient pas au shipper", async () => {
      db.advertisement.findUnique.mockResolvedValue({ id: 'ad1' });
      db.package.count.mockResolvedValue(1); // 1 possédé sur 2 demandés

      await expect(
        service.create({
          advertisementId: 'ad1',
          shipperId: 'u1',
          packageIds: ['p1', 'pVictime'],
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.mission.create).not.toHaveBeenCalled();
    });

    it('crée la mission avec les colis possédés (connect + createMany)', async () => {
      db.advertisement.findUnique.mockResolvedValue({ id: 'ad1' });
      db.package.count.mockResolvedValue(2);
      db.mission.create.mockResolvedValue({ id: 'm1' });

      await service.create({
        advertisementId: 'ad1',
        shipperId: 'u1',
        packageIds: ['p1', 'p2'],
      } as never);

      const arg = db.mission.create.mock.calls[0][0];
      expect(arg.data.advertisement).toEqual({ connect: { id: 'ad1' } });
      expect(arg.data.shipper).toEqual({ connect: { id: 'u1' } });
      expect(arg.data.packages.createMany.data).toEqual([
        { packageId: 'p1' },
        { packageId: 'p2' },
      ]);
    });

    it('crée sans colis (aucun contrôle de propriété)', async () => {
      db.advertisement.findUnique.mockResolvedValue({ id: 'ad1' });
      db.mission.create.mockResolvedValue({ id: 'm1' });

      await service.create(base);

      expect(db.package.count).not.toHaveBeenCalled();
      expect(db.mission.create.mock.calls[0][0].data.packages).toBeUndefined();
    });
  });

  describe('verifyPackagesOwnership', () => {
    it('true seulement si tous les colis appartiennent au owner', async () => {
      db.package.count.mockResolvedValue(2);
      expect(await service.verifyPackagesOwnership(['p1', 'p2'], 'u1')).toBe(
        true,
      );
      db.package.count.mockResolvedValue(1);
      expect(await service.verifyPackagesOwnership(['p1', 'p2'], 'u1')).toBe(
        false,
      );
    });
  });

  describe('addPackages', () => {
    it('déduplique les colis déjà présents avant createMany', async () => {
      db.missionPackage.findMany.mockResolvedValue([{ packageId: 'p1' }]);

      await service.addPackages('m1', ['p1', 'p2', 'p3']);

      expect(db.missionPackage.createMany).toHaveBeenCalledWith({
        data: [
          { packageId: 'p2', missionId: 'm1' },
          { packageId: 'p3', missionId: 'm1' },
        ],
      });
    });
  });

  describe('removePackage', () => {
    it('idempotent : deleteMany (jamais delete)', async () => {
      db.missionPackage.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.removePackage('m1', 'p404'),
      ).resolves.toBeUndefined();
      expect(db.missionPackage.deleteMany).toHaveBeenCalledWith({
        where: { missionId: 'm1', packageId: 'p404' },
      });
    });
  });

  describe('update — machine à états', () => {
    const okSideEffects = () => {
      db.conversation.findMany.mockResolvedValue([]);
    };

    it.each([
      ['PENDING', 'CANCELLED', true],
      ['ACCEPTED', 'IN_TRANSIT', true],
      ['ACCEPTED', 'DISPUTED', true],
      ['IN_TRANSIT', 'CANCELLED', false], // interdit : doit disputer
      ['IN_TRANSIT', 'COMPLETED', true],
      ['COMPLETED', 'CANCELLED', false],
      ['DISPUTED', 'CANCELLED', false], // sortie réservée à l'admin
    ])('%s → %s : autorisé=%s', async (from, to, allowed) => {
      db.mission.findUnique.mockResolvedValue({ status: from });
      db.mission.update.mockResolvedValue({
        id: 'm1',
        advertisementId: 'ad1',
        status: to,
      });
      okSideEffects();

      const call = service.update('m1' as never, { status: to } as never);
      if (allowed) {
        await expect(call).resolves.toBeDefined();
        expect(db.mission.update).toHaveBeenCalled();
      } else {
        await expect(call).rejects.toBeInstanceOf(BadRequestException);
        expect(db.mission.update).not.toHaveBeenCalled();
      }
    });

    it("sans status : persiste sans déclencher d'effets de bord", async () => {
      db.mission.update.mockResolvedValue({ id: 'm1', advertisementId: 'ad1' });

      await service.update('m1' as never, { recipientName: 'Bob' } as never);

      expect(db.mission.findUnique).not.toHaveBeenCalled(); // pas de validateStatusTransition
      expect(db.advertisement.update).not.toHaveBeenCalled(); // pas d'effets de bord
      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('applyStatusSideEffects', () => {
    beforeEach(() =>
      db.conversation.findMany.mockResolvedValue([{ id: 'c1' }]),
    );

    it('CANCELLED : annonce OPEN, transactions PENDING annulées, conversations archivées, event', async () => {
      await service.applyStatusSideEffects({
        id: 'm1',
        advertisementId: 'ad1',
        status: 'CANCELLED' as never,
      });

      expect(db.advertisement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'OPEN' } }),
      );
      expect(db.transaction.updateMany).toHaveBeenCalledWith({
        where: { missionId: 'm1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(db.conversation.updateMany).toHaveBeenCalledWith({
        where: { missionId: 'm1' },
        data: { status: 'ARCHIVED' },
      });
      expect(emitter.emit).toHaveBeenCalledWith('mission.status-changed', {
        missionId: 'm1',
        status: 'CANCELLED',
        conversationIds: ['c1'],
      });
    });

    it("COMPLETED : annonce COMPLETED, PAS d'annulation de transaction, archivage + event", async () => {
      await service.applyStatusSideEffects({
        id: 'm1',
        advertisementId: 'ad1',
        status: 'COMPLETED' as never,
      });

      expect(db.advertisement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
      expect(db.transaction.updateMany).not.toHaveBeenCalled();
      expect(db.conversation.updateMany).toHaveBeenCalled();
    });

    it('ACCEPTED : annonce IN_PROGRESS, ni annulation ni archivage', async () => {
      await service.applyStatusSideEffects({
        id: 'm1',
        advertisementId: 'ad1',
        status: 'ACCEPTED' as never,
      });

      expect(db.advertisement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'IN_PROGRESS' } }),
      );
      expect(db.transaction.updateMany).not.toHaveBeenCalled();
      expect(db.conversation.updateMany).not.toHaveBeenCalled();
      expect(emitter.emit).toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('exclut les missions PENDING et borne la limite à 50', async () => {
      db.mission.findMany.mockResolvedValue([]);
      db.mission.count.mockResolvedValue(0);

      await service.findByUser('u1' as never, { page: 1, limit: 999 } as never);

      const arg = db.mission.findMany.mock.calls[0][0];
      expect(arg.take).toBe(50); // safeLimit
      const inner = arg.where.AND[0];
      expect(inner.OR).toEqual([{ shipperId: 'u1' }, { carrierId: 'u1' }]);
      expect(inner.status).toEqual({ not: 'PENDING' });
    });
  });
});
