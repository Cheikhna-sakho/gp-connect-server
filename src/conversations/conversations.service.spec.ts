import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConversationsService } from './conversations.service';

// Unité pure : DatabaseService + BlocksService mockés.
// Cible : blocage, ownership des colis, soft/hard delete, garde d'offre.

const SHIPPER = 'ship1';
const CARRIER = 'carr1';
const AD = 'ad1';

const makeDb = () => ({
  conversation: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  package: { count: jest.fn() },
  mission: { findFirst: jest.fn() },
});

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: '5',
  });

describe('ConversationsService', () => {
  let db: ReturnType<typeof makeDb>;
  let blocks: { isBlockedBetween: jest.Mock };
  let service: ConversationsService;

  beforeEach(() => {
    db = makeDb();
    blocks = { isBlockedBetween: jest.fn().mockResolvedValue(false) };
    service = new ConversationsService(db as never, blocks as never);
  });

  describe('assertNotBlocked', () => {
    it('no-op si la conversation est introuvable', async () => {
      db.conversation.findUnique.mockResolvedValue(null);
      await expect(
        service.assertNotBlocked('c1', SHIPPER),
      ).resolves.toBeUndefined();
      expect(blocks.isBlockedBetween).not.toHaveBeenCalled();
    });

    it("teste le blocage avec l'AUTRE partie et lève Forbidden si bloqué", async () => {
      db.conversation.findUnique.mockResolvedValue({
        shipperId: SHIPPER,
        carrierId: CARRIER,
      });
      blocks.isBlockedBetween.mockResolvedValue(true);

      await expect(
        service.assertNotBlocked('c1', SHIPPER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(blocks.isBlockedBetween).toHaveBeenCalledWith(SHIPPER, CARRIER);
    });

    it('résout si pas de blocage', async () => {
      db.conversation.findUnique.mockResolvedValue({
        shipperId: SHIPPER,
        carrierId: CARRIER,
      });
      await expect(
        service.assertNotBlocked('c1', CARRIER),
      ).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    const base: Record<string, unknown> = {
      advertisementId: AD,
      shipperId: SHIPPER,
      carrierId: CARRIER,
    };

    it('Forbidden si les deux parties sont bloquées', async () => {
      blocks.isBlockedBetween.mockResolvedValue(true);
      await expect(service.create(base as never)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(db.conversation.create).not.toHaveBeenCalled();
    });

    it("Forbidden si un colis n'appartient pas au shipper", async () => {
      db.package.count.mockResolvedValue(0); // 0 possédé sur 1 demandé
      await expect(
        service.create({ ...base, packageIds: ['pVictime'] } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.conversation.create).not.toHaveBeenCalled();
    });

    it('missionId fourni → connecte la mission existante (pas de création)', async () => {
      db.conversation.create.mockResolvedValue({ id: 'c1' });
      await service.create({ ...base, missionId: 'mDossier' } as never);

      const arg = db.conversation.create.mock.calls[0][0];
      expect(arg.data.mission).toEqual({ connect: { id: 'mDossier' } });
    });

    it('sans missionId → crée une nouvelle mission (avec les colis possédés)', async () => {
      db.package.count.mockResolvedValue(1);
      db.conversation.create.mockResolvedValue({ id: 'c1' });
      await service.create({ ...base, packageIds: ['p1'] } as never);

      const arg = db.conversation.create.mock.calls[0][0];
      expect(arg.data.mission.create.shipperId).toBe(SHIPPER);
      expect(arg.data.mission.create.packages.createMany.data).toEqual([
        { packageId: 'p1' },
      ]);
    });

    it('idempotent : conflit P2002 → renvoie la conversation existante', async () => {
      db.conversation.create.mockRejectedValue(p2002());
      db.conversation.findUnique.mockResolvedValue({ id: 'existante' });

      await expect(service.create(base as never)).resolves.toEqual({
        id: 'existante',
      });
    });
  });

  describe('removeForUser', () => {
    it('Forbidden pour un non-participant', async () => {
      db.conversation.findFirst.mockResolvedValue(null);
      await expect(
        service.removeForUser('c1', 'intrus'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('une seule partie supprime → soft delete (update, pas de delete)', async () => {
      db.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        shipperId: SHIPPER,
        carrierId: CARRIER,
        shipperDeletedAt: null,
        carrierDeletedAt: null,
        mission: null,
      });

      await service.removeForUser('c1', SHIPPER);

      expect(db.conversation.delete).not.toHaveBeenCalled();
      const arg = db.conversation.update.mock.calls[0][0];
      expect(arg.data.shipperDeletedAt).toBeInstanceOf(Date);
    });

    it('les deux ont supprimé, aucune mission active → hard delete', async () => {
      db.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        shipperId: SHIPPER,
        carrierId: CARRIER,
        shipperDeletedAt: null,
        carrierDeletedAt: new Date(), // l'autre a déjà supprimé
        mission: { status: 'COMPLETED' },
      });

      await service.removeForUser('c1', SHIPPER);

      expect(db.conversation.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
    });

    it('les deux ont supprimé mais mission active → conservé en DELETED (preuve)', async () => {
      db.conversation.findFirst.mockResolvedValue({
        id: 'c1',
        shipperId: SHIPPER,
        carrierId: CARRIER,
        shipperDeletedAt: null,
        carrierDeletedAt: new Date(),
        mission: { status: 'IN_TRANSIT' },
      });

      await service.removeForUser('c1', SHIPPER);

      expect(db.conversation.delete).not.toHaveBeenCalled();
      const arg = db.conversation.update.mock.calls[0][0];
      expect(arg.data.status).toBe('DELETED');
    });
  });

  describe('assertOfferAllowed', () => {
    const setAd = (ad: Record<string, unknown> | null) =>
      db.conversation.findFirst.mockResolvedValue(
        ad ? { advertisement: ad } : null,
      );

    it("Forbidden si l'annonce est inaccessible pour ce participant", async () => {
      setAd(null);
      await expect(
        service.assertOfferAllowed('c1', SHIPPER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("BadRequest si l'annonce est expirée", async () => {
      setAd({
        arrivalDate: new Date(Date.now() - 1000),
        status: 'OPEN',
        maxWeight: 10,
      });
      await expect(service.assertOfferAllowed('c1', SHIPPER)).rejects.toThrow(
        'expired',
      );
    });

    it("BadRequest si l'annonce n'est plus disponible", async () => {
      setAd({
        arrivalDate: new Date(Date.now() + 1e6),
        status: 'CLOSED',
        maxWeight: 10,
      });
      await expect(service.assertOfferAllowed('c1', SHIPPER)).rejects.toThrow(
        'no longer available',
      );
    });

    it("BadRequest si le poids dépasse le max de l'annonce", async () => {
      setAd({
        arrivalDate: new Date(Date.now() + 1e6),
        status: 'OPEN',
        maxWeight: 10,
      });
      await expect(
        service.assertOfferAllowed('c1', SHIPPER, 20),
      ).rejects.toThrow('exceeds the advertisement maximum');
    });

    it('résout quand tout est conforme', async () => {
      setAd({
        arrivalDate: new Date(Date.now() + 1e6),
        status: 'IN_PROGRESS',
        maxWeight: 10,
      });
      await expect(
        service.assertOfferAllowed('c1', SHIPPER, 5),
      ).resolves.toBeUndefined();
    });
  });
});
