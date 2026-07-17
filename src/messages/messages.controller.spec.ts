import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UUID } from 'crypto';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ConversationsService } from 'src/conversations/conversations.service';

// Test unitaire du contrôleur : services mockés. On verrouille les GARDES
// (participant-only, blocage, garde d'offre, auteur-only) — pas la couche HTTP.

const USER = 'u1' as UUID;
const CONV = 'c1' as UUID;

describe('MessagesController', () => {
  let controller: MessagesController;
  let messages: jest.Mocked<
    Pick<
      MessagesService,
      | 'find'
      | 'create'
      | 'createMedia'
      | 'findById'
      | 'update'
      | 'updateOffer'
      | 'delete'
    >
  >;
  let convs: jest.Mocked<
    Pick<
      ConversationsService,
      'isParticipant' | 'assertNotBlocked' | 'assertOfferAllowed'
    >
  >;

  beforeEach(() => {
    messages = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      createMedia: jest.fn().mockResolvedValue({}),
      findById: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateOffer: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    } as never;
    convs = {
      isParticipant: jest.fn(),
      assertNotBlocked: jest.fn().mockResolvedValue(undefined),
      assertOfferAllowed: jest.fn().mockResolvedValue(undefined),
    } as never;
    controller = new MessagesController(messages as never, convs as never);
  });

  describe('getAll', () => {
    it('Forbidden pour un non-participant', async () => {
      convs.isParticipant.mockResolvedValue(false);
      await expect(controller.getAll(USER, CONV)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(messages.find).not.toHaveBeenCalled();
    });

    it('participant : renvoie les messages', async () => {
      convs.isParticipant.mockResolvedValue(true);
      await controller.getAll(USER, CONV);
      expect(messages.find).toHaveBeenCalledWith({ conversationId: CONV });
    });
  });

  describe('create', () => {
    it("Forbidden si non-participant (pas d'écriture)", async () => {
      convs.isParticipant.mockResolvedValue(false);
      await expect(
        controller.create(USER, {
          conversationId: CONV,
          type: 'TEXT',
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(messages.create).not.toHaveBeenCalled();
    });

    it('vérifie le blocage puis délègue (TEXT)', async () => {
      convs.isParticipant.mockResolvedValue(true);
      await controller.create(USER, {
        conversationId: CONV,
        type: 'TEXT',
        content: 'x',
      } as never);
      expect(convs.assertNotBlocked).toHaveBeenCalledWith(CONV, USER);
      expect(convs.assertOfferAllowed).not.toHaveBeenCalled();
      expect(messages.create).toHaveBeenCalled();
    });

    it("OFFER : applique la garde d'offre avec le poids", async () => {
      convs.isParticipant.mockResolvedValue(true);
      await controller.create(USER, {
        conversationId: CONV,
        type: 'OFFER',
        offer: { price: 100, weight: 7 },
      } as never);
      expect(convs.assertOfferAllowed).toHaveBeenCalledWith(CONV, USER, 7);
    });
  });

  describe('createMedia', () => {
    it('BadRequest sans conversationId', async () => {
      await expect(
        controller.createMedia(USER, undefined as never, {} as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Forbidden si non-participant', async () => {
      convs.isParticipant.mockResolvedValue(false);
      await expect(
        controller.createMedia(USER, CONV, {} as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('participant : vérifie blocage puis délègue', async () => {
      convs.isParticipant.mockResolvedValue(true);
      await controller.createMedia(USER, CONV, {
        originalname: 'a.png',
      } as never);
      expect(convs.assertNotBlocked).toHaveBeenCalledWith(CONV, USER);
      expect(messages.createMedia).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("Forbidden si le message n'existe pas", async () => {
      messages.findById.mockResolvedValue(null as never);
      await expect(
        controller.update(USER, 'm1' as UUID, { content: 'x' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("Forbidden si l'appelant n'est pas l'auteur", async () => {
      messages.findById.mockResolvedValue({ authorId: 'autre' } as never);
      await expect(
        controller.update(USER, 'm1' as UUID, { content: 'x' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("auteur, édition de texte : n'écrit que content", async () => {
      messages.findById.mockResolvedValue({ authorId: USER } as never);
      await controller.update(USER, 'm1' as UUID, { content: 'edit' } as never);
      expect(messages.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { content: 'edit' },
      });
    });

    it("auteur, édition d'offre : route vers updateOffer", async () => {
      messages.findById.mockResolvedValue({ authorId: USER } as never);
      await controller.update(
        USER,
        'm1' as UUID,
        { offer: { price: 5 } } as never,
      );
      expect(messages.updateOffer).toHaveBeenCalledWith('m1', { price: 5 });
      expect(messages.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('Forbidden si non-auteur', async () => {
      messages.findById.mockResolvedValue({ authorId: 'autre' } as never);
      await expect(
        controller.delete(USER, 'm1' as UUID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('auteur : supprime', async () => {
      messages.findById.mockResolvedValue({ authorId: USER } as never);
      await controller.delete(USER, 'm1' as UUID);
      expect(messages.delete).toHaveBeenCalledWith('m1');
    });
  });
});
