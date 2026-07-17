import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';

// Unité pure : DatabaseService + MediasService + EventEmitter mockés.

const makeDb = () => {
  const tx = {
    message: { create: jest.fn() },
    conversation: { update: jest.fn(), updateMany: jest.fn() },
  };
  return {
    message: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    messageOffer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversation: { update: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  };
};

describe('MessagesService', () => {
  let db: ReturnType<typeof makeDb>;
  let medias: { createByMimetype: jest.Mock; delete: jest.Mock };
  let emitter: { emit: jest.Mock };
  let service: MessagesService;

  beforeEach(() => {
    db = makeDb();
    medias = { createByMimetype: jest.fn(), delete: jest.fn() };
    emitter = { emit: jest.fn() };
    service = new MessagesService(
      db as never,
      medias as never,
      emitter as never,
    );
  });

  describe('create', () => {
    it('TEXT : crée le message, réveille la conversation (annule soft delete), émet', async () => {
      const created = { id: 'msg1', createdAt: new Date() };
      db.message.create.mockResolvedValue(created);

      await service.create({
        type: 'TEXT',
        content: 'hi',
        authorId: 'u1',
        conversationId: 'c1',
      } as never);

      expect(db.message.create).toHaveBeenCalled();
      // touchConversation : lastMessageAt + reset des soft-deletes
      expect(db.conversation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({
          shipperDeletedAt: null,
          carrierDeletedAt: null,
        }),
      });
      expect(emitter.emit).toHaveBeenCalledWith(
        'message.created',
        expect.objectContaining({ conversationId: 'c1' }),
      );
    });

    it("OFFER : crée l'offre imbriquée", async () => {
      db.message.create.mockResolvedValue({
        id: 'msg1',
        createdAt: new Date(),
      });

      await service.create({
        type: 'OFFER',
        authorId: 'u1',
        conversationId: 'c1',
        offer: { price: 100, weight: 5 },
      } as never);

      const arg = db.message.create.mock.calls[0][0];
      expect(arg.data.offer).toEqual({ create: { price: 100, weight: 5 } });
    });
  });

  describe('updateOffer', () => {
    it("NotFound si l'offre n'existe pas", async () => {
      db.messageOffer.findUnique.mockResolvedValue(null);
      await expect(
        service.updateOffer('o1', {} as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("BadRequest si l'offre n'est plus PENDING", async () => {
      db.messageOffer.findUnique.mockResolvedValue({ status: 'ACCEPTED' });
      await expect(
        service.updateOffer('o1', { price: 1 } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("PENDING : n'écrit QUE price/weight", async () => {
      db.messageOffer.findUnique.mockResolvedValue({ status: 'PENDING' });
      db.messageOffer.update.mockResolvedValue({});

      await service.updateOffer('o1', {
        price: 200,
        weight: 8,
        status: 'ACCEPTED',
        missionId: 'x',
      } as never);

      expect(db.messageOffer.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { price: 200, weight: 8 },
      });
    });
  });

  describe('createMedia', () => {
    it('succès : transaction + event', async () => {
      medias.createByMimetype.mockResolvedValue({ id: 'media1' });
      db.__tx.message.create.mockResolvedValue({
        id: 'msg1',
        createdAt: new Date(),
      });

      const res = await service.createMedia('u1', 'c1', {} as never);

      expect(res).toEqual(expect.objectContaining({ id: 'msg1' }));
      expect(emitter.emit).toHaveBeenCalledWith(
        'message.created',
        expect.objectContaining({ conversationId: 'c1' }),
      );
      expect(medias.delete).not.toHaveBeenCalled();
    });

    it('échec en transaction : compense en supprimant le média, puis relève', async () => {
      medias.createByMimetype.mockResolvedValue({ id: 'media1' });
      db.$transaction.mockRejectedValue(new Error('boom'));

      await expect(
        service.createMedia('u1', 'c1', {} as never),
      ).rejects.toThrow('boom');
      expect(medias.delete).toHaveBeenCalledWith({ id: 'media1' });
    });
  });
});
