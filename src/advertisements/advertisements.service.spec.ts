import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdvertisementsService } from './advertisements.service';

// Unité pure : DatabaseService mocké. Cible : ownership des colis + mission-dossier
// SHIPPING à la création, mapping 404 sur P2025, et anti-fuite PII de findOffers.

const AUTHOR = 'auth1';

const makeDb = () => ({
  advertisement: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  package: { count: jest.fn() },
  messageOffer: { findMany: jest.fn() },
});

const p2025 = () => Object.assign(new Error('not found'), { code: 'P2025' });

describe('AdvertisementsService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: AdvertisementsService;

  beforeEach(() => {
    db = makeDb();
    service = new AdvertisementsService(db as never);
  });

  describe('create', () => {
    const base = {
      authorId: AUTHOR,
      departureId: 'dep1',
      destinationId: 'des1',
      arrivalDate: '2026-12-01',
      type: 'DELIVERY',
    };

    it("BadRequest si un colis n'appartient pas à l'auteur", async () => {
      db.package.count.mockResolvedValue(0);
      await expect(
        service.create({
          ...base,
          type: 'SHIPPING',
          packageIds: ['pVictime'],
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.advertisement.create).not.toHaveBeenCalled();
    });

    it('SHIPPING : crée la mission-dossier (shipper connecté, colis rattachés)', async () => {
      db.package.count.mockResolvedValue(1);
      db.advertisement.create.mockResolvedValue({ id: 'ad1' });

      await service.create({
        ...base,
        type: 'SHIPPING',
        packageIds: ['p1'],
      } as never);

      const arg = db.advertisement.create.mock.calls[0][0];
      expect(arg.data.missions.create.shipper.connect).toEqual({ id: AUTHOR });
      expect(arg.data.missions.create.packages.createMany.data).toEqual([
        { packageId: 'p1' },
      ]);
      expect(arg.data.author.connect).toEqual({ id: AUTHOR });
    });

    it('DELIVERY : pas de mission-dossier', async () => {
      db.advertisement.create.mockResolvedValue({ id: 'ad1' });
      await service.create(base as never);
      const arg = db.advertisement.create.mock.calls[0][0];
      expect(arg.data.missions).toBeUndefined();
    });
  });

  describe('update / delete — mapping P2025', () => {
    it('update : P2025 → NotFound', async () => {
      db.advertisement.update.mockRejectedValue(p2025());
      await expect(
        service.update({
          where: { id: 'x', authorId: AUTHOR },
          data: {},
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('delete : P2025 → NotFound', async () => {
      db.advertisement.delete.mockRejectedValue(p2025());
      await expect(
        service.delete({ where: { id: 'x', authorId: AUTHOR } } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOffers — anti-fuite PII', () => {
    it("sérialise l'auteur en PublicUserEntity (pas d'email)", async () => {
      db.messageOffer.findMany.mockResolvedValue([
        {
          id: 'o1',
          price: 100,
          weight: 5,
          status: 'PENDING',
          message: {
            createdAt: new Date('2026-01-01'),
            author: {
              id: 'u1',
              firstName: 'Alice',
              lastName: 'M',
              email: 'secret@x.com',
              phone: '+221770000000',
            },
          },
        },
      ]);

      const [offer] = await service.findOffers('ad1');

      const author = offer.author as unknown as Record<string, unknown>;
      expect(author.firstName).toBe('Alice');
      expect(author.email).toBeUndefined();
      expect(author.phone).toBeUndefined();
      expect(offer.createdAt).toEqual(new Date('2026-01-01'));
      expect(offer.price).toBe(100);
    });
  });

  describe('searchMine — authorId non surchargeable', () => {
    it('authorId du token écrase un ?authorId= injecté en query', async () => {
      // un attaquant tente de lister les annonces d'autrui via ?authorId=
      db.advertisement.findMany.mockResolvedValue([]);
      db.advertisement.count.mockResolvedValue(0);

      await service.searchMine(AUTHOR, { authorId: 'victime' } as never);

      const { where } = db.advertisement.findMany.mock.calls[0][0];
      expect(where.authorId).toBe(AUTHOR);
    });
  });

  describe('searchPublic', () => {
    it('OPEN + non expirées ; prix max et poids min traduits en lte/gte', async () => {
      db.advertisement.findMany.mockResolvedValue([]);
      db.advertisement.count.mockResolvedValue(0);

      await service.searchPublic({ price: 30, maxWeight: 5 } as never);

      const { where } = db.advertisement.findMany.mock.calls[0][0];
      expect(where.status).toBe('OPEN');
      expect(where.price).toEqual({ lte: 30 });
      expect(where.maxWeight).toEqual({ gte: 5 });
      expect(where.arrivalDate.gte).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('borne la limite à 50 et renvoie {data, meta}', async () => {
      db.advertisement.findMany.mockResolvedValue([{ id: 'ad1' }]);
      db.advertisement.count.mockResolvedValue(1);

      const res = await service.findAll({}, { page: 1, limit: 999 });

      expect(db.advertisement.findMany.mock.calls[0][0].take).toBe(50);
      expect(res.meta.limit).toBe(50);
      expect(res.data).toEqual([{ id: 'ad1' }]);
    });
  });
});
