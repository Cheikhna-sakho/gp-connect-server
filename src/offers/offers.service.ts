import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabaseService } from 'src/database/database.service';
import { UpdateOfferDto } from 'src/messages/dtos/message-offer-update.dto';

@Injectable()
export class OffersService {
  private offers: DatabaseService['messageOffer'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.offers = this.databaseService.messageOffer;
  }

  findOne(id: string) {
    return this.offers.findUnique({
      where: { id },
      include: {
        mission: {
          select: { id: true, carrierId: true, shipperId: true, status: true },
        },
        message: { select: { conversationId: true, authorId: true } },
      },
    });
  }

  async findAllAccepted(conversationId: string) {
    return this.offers.findMany({
      where: { message: { conversationId }, status: 'ACCEPTED' },
    });
  }

  async findLastAccepted(conversationId: string) {
    return this.offers.findFirst({
      where: { message: { conversationId }, status: 'ACCEPTED' },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Acceptance — full business logic in one transaction ──────────────────

  private async accept(offerId: string, userId: string) {
    const offer = await this.offers.findUnique({
      where: { id: offerId },
      include: {
        message: {
          select: {
            authorId: true,
            conversationId: true,
            conversation: {
              select: {
                id: true,
                shipperId: true,
                carrierId: true,
                missionId: true,
              },
            },
          },
        },
      },
    });

    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('This offer is no longer pending');
    }

    const { conversation } = offer.message;
    const { shipperId, carrierId, missionId } = conversation;

    if (userId !== shipperId && userId !== carrierId)
      throw new ForbiddenException();
    if (offer.message.authorId === userId) {
      throw new ForbiddenException('Cannot accept your own offer');
    }
    if (!missionId) {
      throw new BadRequestException('No mission linked to this conversation');
    }

    // Gating KYC : un transporteur doit avoir vérifié son identité avant de
    // se voir confier des colis. C'est ici (et seulement ici) que la
    // vérification d'identité devient bloquante — pas à l'inscription.
    const carrier = await this.databaseService.user.findUnique({
      where: { id: carrierId },
      select: { idCardVerifiedAt: true },
    });
    if (!carrier?.idCardVerifiedAt) {
      throw new ForbiddenException(
        userId === carrierId
          ? "Vérifiez votre identité (Paramètres) avant d'accepter une mission."
          : "Ce transporteur n'a pas encore vérifié son identité — la mission ne peut pas démarrer.",
      );
    }

    const result = await this.databaseService.$transaction(async (tx) => {
      const mission = await tx.mission.findUnique({
        where: { id: missionId },
        select: { status: true, advertisementId: true },
      });

      if (!mission) throw new NotFoundException('Mission not found');
      if (mission.status !== 'PENDING') {
        throw new BadRequestException(
          'This conversation already has an accepted offer',
        );
      }

      await tx.mission.update({
        where: { id: missionId },
        data: { carrierId, negotiatedPrice: offer.price, status: 'ACCEPTED' },
      });

      await tx.advertisement.update({
        where: { id: mission.advertisementId },
        data: { status: 'IN_PROGRESS' },
      });

      await tx.messageOffer.update({
        where: { id: offerId },
        data: { status: 'ACCEPTED', missionId },
      });

      await tx.messageOffer.updateMany({
        where: {
          id: { not: offerId },
          status: 'PENDING',
          message: { conversationId: conversation.id },
        },
        data: { status: 'REJECTED' },
      });

      await tx.transaction.create({
        data: {
          missionId,
          amount: offer.price,
          method: 'CASH',
          status: 'PENDING',
        },
      });

      // Cancel other PENDING missions for this advertisement (one accepted = others closed)
      await tx.mission.updateMany({
        where: {
          advertisementId: mission.advertisementId,
          id: { not: missionId },
          status: 'PENDING',
        },
        data: { status: 'CANCELLED' },
      });
      // Archive their conversations (all other active conversations for this ad)
      await tx.conversation.updateMany({
        where: {
          advertisementId: mission.advertisementId,
          id: { not: conversation.id },
          status: 'ACTIVE',
        },
        data: { status: 'ARCHIVED' },
      });

      return tx.messageOffer.findUnique({
        where: { id: offerId },
        include: {
          mission: {
            select: {
              id: true,
              status: true,
              carrierId: true,
              shipperId: true,
              negotiatedPrice: true,
            },
          },
        },
      });
    });

    this.eventEmitter.emit('offer.updated', {
      offer: result,
      conversationId: conversation.id,
    });
    // Broadcast mission transition so frontend knows without a refetch
    this.eventEmitter.emit('mission.status-changed', {
      missionId,
      status: 'ACCEPTED',
      conversationIds: [conversation.id],
    });

    return result;
  }

  // ─── Generic update (REJECTED, price/weight edits) ────────────────────────

  async update(id: string, userId: string, data: UpdateOfferDto) {
    if (data.status === 'ACCEPTED') {
      return this.accept(id, userId);
    }

    const offer = await this.offers.findUnique({
      where: { id },
      include: {
        message: {
          select: {
            authorId: true,
            conversationId: true,
            conversation: {
              select: { id: true, shipperId: true, carrierId: true },
            },
          },
        },
      },
    });

    if (!offer) throw new NotFoundException();
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('This offer is no longer pending');
    }

    const { shipperId, carrierId } = offer.message.conversation;
    if (userId !== shipperId && userId !== carrierId)
      throw new ForbiddenException();

    if (
      data.status &&
      data.status !== 'PENDING' &&
      offer.message.authorId === userId
    ) {
      throw new ForbiddenException(
        'Cannot change the status of your own offer',
      );
    }

    const updated = await this.offers.update({ where: { id }, data });

    this.eventEmitter.emit('offer.updated', {
      offer: updated,
      conversationId: offer.message.conversationId,
    });

    return updated;
  }
}
