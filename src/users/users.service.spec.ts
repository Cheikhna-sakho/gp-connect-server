import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

// Unité pure : le service est instancié avec des dépendances entièrement
// mockées (pas de conteneur Nest, pas de DB). On teste la logique métier et on
// verrouille les régressions des bugs corrigés (saveAddress 404, removeSavedAddress
// idempotent, verifyEmailToken sur token absent, reset KYC de updateById).

const makeDb = () => ({
  user: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userAvatar: { findUnique: jest.fn(), upsert: jest.fn() },
  verificationToken: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  savedAddress: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  address: { findUnique: jest.fn() },
  userPreferences: { upsert: jest.fn() },
  mission: { count: jest.fn() },
  package: { count: jest.fn() },
  transaction: { aggregate: jest.fn() },
  missionRating: { aggregate: jest.fn() },
  $transaction: jest.fn().mockResolvedValue([]),
});

describe('UsersService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = new UsersService(
      db as never,
      { createImage: jest.fn(), delete: jest.fn() } as never,
      {
        sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
  });

  describe('saveAddress', () => {
    it("lève NotFoundException si l'adresse n'existe pas (sans upsert)", async () => {
      db.address.findUnique.mockResolvedValue(null);

      await expect(service.saveAddress('u1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.savedAddress.upsert).not.toHaveBeenCalled();
    });

    it("upsert et renvoie l'adresse quand elle existe", async () => {
      db.address.findUnique.mockResolvedValue({ id: 'a1' });
      db.savedAddress.upsert.mockResolvedValue({ address: { id: 'a1' } });

      const res = await service.saveAddress('u1', 'a1', 'Maison');

      expect(db.savedAddress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_addressId: { userId: 'u1', addressId: 'a1' } },
          create: { userId: 'u1', addressId: 'a1', label: 'Maison' },
        }),
      );
      expect(res).toEqual({ id: 'a1' });
    });
  });

  describe('removeSavedAddress', () => {
    it('est idempotent : deleteMany (ne lève pas si rien à supprimer)', async () => {
      db.savedAddress.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.removeSavedAddress('u1', 'never-saved'),
      ).resolves.toBeUndefined();

      expect(db.savedAddress.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', addressId: 'never-saved' },
      });
    });
  });

  describe('updateById — intégrité de la vérification (KYC)', () => {
    it('email changé : bascule DIFFÉRÉE — pendingEmail écrit, email intact, vérif conservée', async () => {
      // findUnique #1 : lecture du compte courant (updateById)
      // findFirst : findByEmail (unicité) — personne ne détient la nouvelle adresse
      db.user.findUnique.mockResolvedValue({ email: 'old@x.com', phone: null });
      db.user.findFirst.mockResolvedValue(null);
      db.user.update.mockResolvedValue({});

      await service.updateById('u1', { email: 'new@x.com' } as never);

      const arg = db.user.update.mock.calls[0][0];
      expect(arg.data.pendingEmail).toBe('new@x.com');
      expect(arg.data.email).toBeUndefined();
      expect(arg.data.emailVerifiedAt).toBeUndefined();
    });

    it('email déjà pris par un autre compte → Conflict 409, sans écriture', async () => {
      db.user.findUnique.mockResolvedValue({ email: 'old@x.com', phone: null });
      db.user.findFirst.mockResolvedValue({ id: 'autre' });

      await expect(
        service.updateById('u1', { email: 'taken@x.com' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it("ne déclenche rien si l'email est identique", async () => {
      db.user.findUnique.mockResolvedValue({
        email: 'same@x.com',
        phone: null,
      });
      db.user.update.mockResolvedValue({});

      await service.updateById('u1', { email: 'same@x.com' } as never);

      const arg = db.user.update.mock.calls[0][0];
      expect(arg.data.pendingEmail).toBeUndefined();
      expect(arg.data.emailVerifiedAt).toBeUndefined();
    });

    it('P2002 à l’écriture (téléphone déjà pris) → Conflict 409', async () => {
      db.user.findUnique.mockResolvedValue({ email: 'a@x.com', phone: null });
      db.user.update.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );

      await expect(
        service.updateById('u1', { phone: '+221770000000' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('réinitialise phoneVerifiedAt quand le téléphone change', async () => {
      db.user.findUnique.mockResolvedValue({
        email: 'a@x.com',
        phone: '+221770000000',
      });
      db.user.update.mockResolvedValue({});

      await service.updateById('u1', { phone: '+221771111111' } as never);

      const arg = db.user.update.mock.calls[0][0];
      expect(arg.data.phoneVerifiedAt).toBeNull();
    });

    it('ne lit pas le compte si ni email ni téléphone ne changent', async () => {
      db.user.update.mockResolvedValue({});

      await service.updateById('u1', { firstName: 'Bob' } as never);

      expect(db.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('agrège les compteurs et calcule les dérivés', async () => {
      db.mission.count
        .mockResolvedValueOnce(3) // carrier
        .mockResolvedValueOnce(2); // shipper
      db.package.count.mockResolvedValue(5);
      db.transaction.aggregate.mockResolvedValue({ _sum: { amount: 150 } });
      db.missionRating.aggregate.mockResolvedValue({
        _avg: { score: 4.66 },
        _count: { score: 9 },
      });

      const stats = await service.getStats('u1');

      expect(stats).toEqual({
        missionsCompleted: 5,
        missionsAsCarrier: 3,
        missionsAsShipper: 2,
        packagesDelivered: 5,
        totalEarned: 150,
        averageRating: 4.7,
        ratingsCount: 9,
      });
    });

    it('averageRating null quand aucune note', async () => {
      db.mission.count.mockResolvedValue(0);
      db.package.count.mockResolvedValue(0);
      db.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
      db.missionRating.aggregate.mockResolvedValue({
        _avg: { score: null },
        _count: { score: 0 },
      });

      const stats = await service.getStats('u1');
      expect(stats.averageRating).toBeNull();
      expect(stats.totalEarned).toBe(0);
    });
  });

  describe('findByIdentifier', () => {
    it('résout par email (insensible à la casse) OU téléphone', async () => {
      db.user.findFirst.mockResolvedValue({ id: 'u1' });

      await service.findByIdentifier('Alice@X.com');

      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { equals: 'Alice@X.com', mode: 'insensitive' } },
              { phone: 'Alice@X.com' },
            ],
          },
        }),
      );
    });
  });
});
