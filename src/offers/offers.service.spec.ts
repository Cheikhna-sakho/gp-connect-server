import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OffersService } from './offers.service';

// Unité pure : DatabaseService + EventEmitter mockés. `$transaction(cb)` est
// mocké pour exécuter le callback avec un client `tx` lui-même mocké.
// Cible : l'acceptation d'offre (le point le plus critique du flux) et ses gardes.

const SHIPPER = 'ship1';
const CARRIER = 'carr1';
const AUTHOR = CARRIER; // l'offre est faite par le carrier ; le shipper l'accepte
const OFFER = 'offer1';
const MISSION = 'm1';

const makeDb = () => {
  const tx = {
    mission: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    advertisement: { update: jest.fn() },
    messageOffer: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: { create: jest.fn() },
    conversation: { updateMany: jest.fn() },
  };
  return {
    messageOffer: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    conversation: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  };
};

// offre PENDING, faite par le carrier, conversation liée à une mission PENDING
const offerForAccept = (over: Record<string, unknown> = {}) => ({
  id: OFFER,
  status: 'PENDING',
  price: 120,
  message: {
    authorId: AUTHOR,
    conversationId: 'conv1',
    conversation: {
      id: 'conv1',
      shipperId: SHIPPER,
      carrierId: CARRIER,
      missionId: MISSION,
    },
  },
  ...over,
});

describe('OffersService', () => {
  let db: ReturnType<typeof makeDb>;
  let emitter: { emit: jest.Mock };
  let service: OffersService;

  beforeEach(() => {
    db = makeDb();
    emitter = { emit: jest.fn() };
    const email = { sendOfferAccepted: jest.fn() };
    service = new OffersService(db as never, emitter as never, email as never);
  });

  const acceptAsShipper = () =>
    service.update(OFFER, SHIPPER, { status: 'ACCEPTED' } as never);

  describe('accept (via update status=ACCEPTED)', () => {
    it("NotFound si l'offre n'existe pas", async () => {
      db.messageOffer.findUnique.mockResolvedValue(null);
      await expect(acceptAsShipper()).rejects.toBeInstanceOf(NotFoundException);
    });

    it("BadRequest si l'offre n'est plus PENDING", async () => {
      db.messageOffer.findUnique.mockResolvedValue(
        offerForAccept({ status: 'REJECTED' }),
      );
      await expect(acceptAsShipper()).rejects.toThrow('no longer pending');
    });

    it('Forbidden pour un non-participant', async () => {
      db.messageOffer.findUnique.mockResolvedValue(offerForAccept());
      await expect(
        service.update(OFFER, 'intrus', { status: 'ACCEPTED' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Forbidden : on ne peut pas accepter sa propre offre', async () => {
      db.messageOffer.findUnique.mockResolvedValue(offerForAccept());
      // le carrier est l'auteur → il ne peut pas accepter
      await expect(
        service.update(OFFER, CARRIER, { status: 'ACCEPTED' } as never),
      ).rejects.toThrow('Cannot accept your own offer');
    });

    it('BadRequest si aucune mission liée à la conversation', async () => {
      db.messageOffer.findUnique.mockResolvedValue(
        offerForAccept({
          message: {
            authorId: AUTHOR,
            conversationId: 'conv1',
            conversation: {
              id: 'conv1',
              shipperId: SHIPPER,
              carrierId: CARRIER,
              missionId: null,
            },
          },
        }),
      );
      await expect(acceptAsShipper()).rejects.toThrow('No mission linked');
    });

    it("Forbidden (gate KYC) si le carrier n'a pas vérifié son identité", async () => {
      db.messageOffer.findUnique.mockResolvedValue(offerForAccept());
      db.user.findUnique.mockResolvedValue({ idCardVerifiedAt: null });
      await expect(acceptAsShipper()).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("BadRequest si la mission n'est plus PENDING (course/double accept)", async () => {
      db.messageOffer.findUnique.mockResolvedValue(offerForAccept());
      db.user.findUnique.mockResolvedValue({ idCardVerifiedAt: new Date() });
      db.__tx.mission.findUnique.mockResolvedValue({
        status: 'ACCEPTED',
        advertisementId: 'ad1',
      });
      await expect(acceptAsShipper()).rejects.toThrow(
        'already has an accepted offer',
      );
    });

    it('happy : assigne carrier+prix, rejette les autres, crée la transaction, émet 2 events', async () => {
      db.messageOffer.findUnique.mockResolvedValue(offerForAccept());
      db.user.findUnique.mockResolvedValue({ idCardVerifiedAt: new Date() });
      db.__tx.mission.findUnique.mockResolvedValue({
        status: 'PENDING',
        advertisementId: 'ad1',
      });
      db.__tx.messageOffer.findUnique.mockResolvedValue({
        id: OFFER,
        mission: {},
      });

      const res = await acceptAsShipper();

      // mission passe en ACCEPTED avec carrier + prix négocié — verrou
      // optimiste : le WHERE porte le statut PENDING
      expect(db.__tx.mission.updateMany).toHaveBeenCalledWith({
        where: { id: MISSION, status: 'PENDING' },
        data: { carrierId: CARRIER, negotiatedPrice: 120, status: 'ACCEPTED' },
      });
      // annonce IN_PROGRESS
      expect(db.__tx.advertisement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'IN_PROGRESS' } }),
      );
      // offre acceptée + rattachée à la mission
      expect(db.__tx.messageOffer.update).toHaveBeenCalledWith({
        where: { id: OFFER },
        data: { status: 'ACCEPTED', missionId: MISSION },
      });
      // les autres offres PENDING de la conversation sont rejetées
      expect(db.__tx.messageOffer.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'REJECTED' } }),
      );
      // transaction PENDING créée au montant de l'offre
      expect(db.__tx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            missionId: MISSION,
            amount: 120,
            status: 'PENDING',
          }),
        }),
      );
      // les autres missions PENDING de l'annonce sont annulées
      expect(db.__tx.mission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED' } }),
      );
      // events temps réel
      const events = emitter.emit.mock.calls.map((c) => c[0]);
      expect(events).toEqual(
        expect.arrayContaining(['offer.updated', 'mission.status-changed']),
      );
      expect(res).toEqual({ id: OFFER, mission: {} });
    });
  });

  describe('update status=REJECTED', () => {
    const rejectableOffer = (over: Record<string, unknown> = {}) => ({
      id: OFFER,
      status: 'PENDING',
      message: {
        authorId: CARRIER,
        conversationId: 'conv1',
        conversation: { id: 'conv1', shipperId: SHIPPER, carrierId: CARRIER },
      },
      ...over,
    });

    it('Forbidden : on ne peut pas rejeter sa propre offre', async () => {
      db.messageOffer.findUnique.mockResolvedValue(rejectableOffer());
      await expect(
        service.update(OFFER, CARRIER, { status: 'REJECTED' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('happy : le contre-parti rejette → updateMany verrouillé + event', async () => {
      db.messageOffer.findUnique
        .mockResolvedValueOnce(rejectableOffer())
        .mockResolvedValueOnce({ id: OFFER, status: 'REJECTED' });
      db.messageOffer.updateMany.mockResolvedValue({ count: 1 });

      await service.update(OFFER, SHIPPER, { status: 'REJECTED' } as never);

      // verrou optimiste : le WHERE porte le statut PENDING
      expect(db.messageOffer.updateMany).toHaveBeenCalledWith({
        where: { id: OFFER, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      expect(emitter.emit).toHaveBeenCalledWith(
        'offer.updated',
        expect.objectContaining({ conversationId: 'conv1' }),
      );
      // pas de transaction pour un simple rejet
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('course : reject perdu si l’offre n’est plus PENDING (count 0 → 400)', async () => {
      db.messageOffer.findUnique.mockResolvedValue(rejectableOffer());
      db.messageOffer.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.update(OFFER, SHIPPER, { status: 'REJECTED' } as never),
      ).rejects.toThrow('no longer pending');
    });
  });

  describe('findLastAccepted', () => {
    it('Forbidden si non-participant de la conversation', async () => {
      db.conversation.findFirst.mockResolvedValue(null);
      await expect(
        service.findLastAccepted('conv1', 'intrus'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.messageOffer.findFirst).not.toHaveBeenCalled();
    });

    it('participant : renvoie la dernière offre acceptée', async () => {
      db.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
      db.messageOffer.findFirst.mockResolvedValue({ id: OFFER });
      await expect(service.findLastAccepted('conv1', SHIPPER)).resolves.toEqual(
        {
          id: OFFER,
        },
      );
    });
  });
});
