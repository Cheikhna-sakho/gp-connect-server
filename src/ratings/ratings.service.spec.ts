import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';

// Unité pure : service instancié directement avec un DatabaseService mocké.
// Verrouille les gardes de create (404 / 400 / 403 / conflit P2002), le fait
// que le ratedId soit bien l'AUTRE partie de la mission, et les agrégations.

const makeDb = () => ({
  missionRating: {
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  mission: {
    findUnique: jest.fn(),
  },
});

// Simule un conflit d'unicité Prisma (déjà noté cette mission).
const p2002 = () => Object.assign(new Error('unique'), { code: 'P2002' });

describe('RatingsService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: RatingsService;

  beforeEach(() => {
    db = makeDb();
    service = new RatingsService(db as never);
  });

  describe('create', () => {
    const dto = { score: 5, comment: 'super' } as never;

    it("lève NotFound si la mission n'existe pas (sans créer de note)", async () => {
      db.mission.findUnique.mockResolvedValue(null);

      await expect(service.create('m1', 'u1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.missionRating.create).not.toHaveBeenCalled();
    });

    it("lève BadRequest si la mission n'est pas COMPLETED", async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'IN_PROGRESS',
        shipperId: 'shipper',
        carrierId: 'carrier',
      });

      await expect(service.create('m1', 'shipper', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.missionRating.create).not.toHaveBeenCalled();
    });

    it("lève Forbidden si le rater n'est ni shipper ni carrier", async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'COMPLETED',
        shipperId: 'shipper',
        carrierId: 'carrier',
      });

      await expect(service.create('m1', 'intrus', dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(db.missionRating.create).not.toHaveBeenCalled();
    });

    it('shipper note le carrier : ratedId = carrier', async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'COMPLETED',
        shipperId: 'shipper',
        carrierId: 'carrier',
      });
      db.missionRating.create.mockResolvedValue({ id: 'r1' });

      const res = await service.create('m1', 'shipper', dto);

      expect(res).toEqual({ id: 'r1' });
      expect(db.missionRating.create).toHaveBeenCalledWith({
        data: {
          missionId: 'm1',
          raterId: 'shipper',
          ratedId: 'carrier',
          score: 5,
          comment: 'super',
        },
      });
    });

    it('carrier note le shipper : ratedId = shipper', async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'COMPLETED',
        shipperId: 'shipper',
        carrierId: 'carrier',
      });
      db.missionRating.create.mockResolvedValue({ id: 'r2' });

      await service.create('m1', 'carrier', dto);

      expect(db.missionRating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            raterId: 'carrier',
            ratedId: 'shipper',
          }),
        }),
      );
    });

    it("lève BadRequest si aucun carrier n'est assigné", async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'COMPLETED',
        shipperId: 'shipper',
        carrierId: null,
      });

      await expect(service.create('m1', 'shipper', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.missionRating.create).not.toHaveBeenCalled();
    });

    it('conflit P2002 → ConflictException (already rated)', async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'COMPLETED',
        shipperId: 'shipper',
        carrierId: 'carrier',
      });
      db.missionRating.create.mockRejectedValue(p2002());

      await expect(service.create('m1', 'shipper', dto)).rejects.toThrow(
        'already rated',
      );
    });

    it('propage les autres erreurs telles quelles', async () => {
      db.mission.findUnique.mockResolvedValue({
        status: 'COMPLETED',
        shipperId: 'shipper',
        carrierId: 'carrier',
      });
      db.missionRating.create.mockRejectedValue(new Error('db down'));

      await expect(service.create('m1', 'shipper', dto)).rejects.toThrow(
        'db down',
      );
    });
  });

  describe('findByMission', () => {
    it('renvoie les notes scopées sur missionId', async () => {
      const rows = [{ id: 'r1' }, { id: 'r2' }];
      db.missionRating.findMany.mockResolvedValue(rows);

      const res = await service.findByMission('m1');

      expect(res).toBe(rows);
      expect(db.missionRating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { missionId: 'm1' } }),
      );
    });
  });

  describe('findByUser', () => {
    it('agrège correctement { ratings, averageScore, total }', async () => {
      const rows = [{ id: 'r1' }, { id: 'r2' }];
      db.missionRating.findMany.mockResolvedValue(rows);
      db.missionRating.aggregate.mockResolvedValue({
        _avg: { score: 4.5 },
        _count: { score: 2 },
      });

      const res = await service.findByUser('u1');

      expect(res).toEqual({
        ratings: rows,
        averageScore: 4.5,
        total: 2,
      });
      expect(db.missionRating.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ratedId: 'u1' } }),
      );
      expect(db.missionRating.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ratedId: 'u1' } }),
      );
    });
  });
});
