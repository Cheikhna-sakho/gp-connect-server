import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { UUID } from 'crypto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { CreateMessageDto } from './dtos/message.dto';
import { MessageUpdateDto } from './dtos/message-update.dto';
import { ConversationsService } from 'src/conversations/conversations.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { MessageEntity } from './entities/message.entity';

const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'video/mp4',
  'video/webm',
];

@ApiTags('messages')
@ApiAuth()
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get(SetIdParam('conversationId'))
  @ApiForbiddenResponse({
    description: 'Non-participant de la conversation',
  })
  @Serialize(MessageEntity)
  async getAll(
    @GetUserId() userId: UUID,
    @Param('conversationId') conversationId: UUID,
  ) {
    const allowed = await this.conversationsService.isParticipant(
      conversationId,
      userId,
    );
    if (!allowed) throw new ForbiddenException();
    return this.messagesService.find({ conversationId });
  }

  // Anti-spam : plafond dédié (le global 100/min laissait trop de marge)
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post()
  @ApiForbiddenResponse({
    description:
      'Non-participant, blocage entre les parties, ou offre non autorisée',
  })
  @ApiBadRequestResponse({
    description:
      'Payload invalide (type/contenu), poids d’offre hors annonce, ou RDV daté dans le passé',
  })
  @ApiTooManyRequestsResponse({
    description: 'Plafond 40 messages/min atteint',
  })
  @Serialize(MessageEntity)
  async create(@GetUserId() authorId: UUID, @Body() data: CreateMessageDto) {
    const allowed = await this.conversationsService.isParticipant(
      data.conversationId,
      authorId,
    );
    if (!allowed) throw new ForbiddenException();
    await this.conversationsService.assertNotBlocked(
      data.conversationId,
      authorId,
    );

    if (data.type === 'OFFER') {
      await this.conversationsService.assertOfferAllowed(
        data.conversationId,
        authorId,
        data.offer?.weight,
      );
    }

    // Un RDV dans le passé n'a pas de sens — refusé à la porte.
    if (
      data.type === 'APPOINTMENT' &&
      new Date(data.appointment.scheduledAt) <= new Date()
    ) {
      throw new BadRequestException('Appointment must be in the future');
    }

    return this.messagesService.create({ ...data, authorId });
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post('media')
  @ApiForbiddenResponse({
    description: 'Non-participant ou blocage entre les parties',
  })
  @ApiBadRequestResponse({
    description:
      'conversationId manquant ou type de fichier hors allowlist (image/audio/vidéo)',
  })
  @ApiPayloadTooLargeResponse({ description: 'Fichier > 20 Mo' })
  @ApiTooManyRequestsResponse({ description: 'Plafond 40 envois/min atteint' })
  @Serialize(MessageEntity)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MEDIA_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException(`File type not allowed: ${file.mimetype}`),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async createMedia(
    @GetUserId() authorId: UUID,
    @Body('conversationId') conversationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!conversationId)
      throw new BadRequestException('conversationId is required');
    const allowed = await this.conversationsService.isParticipant(
      conversationId,
      authorId,
    );
    if (!allowed) throw new ForbiddenException();
    await this.conversationsService.assertNotBlocked(conversationId, authorId);
    return this.messagesService.createMedia(authorId, conversationId, file);
  }

  @Patch(ID_PARAM)
  @ApiForbiddenResponse({
    description: 'Seul l’auteur du message peut le modifier',
  })
  @ApiBadRequestResponse({ description: 'Offre non modifiable (plus PENDING)' })
  @Serialize(MessageEntity)
  async update(
    @GetUserId() userId: UUID,
    @Param('id') id: UUID,
    @Body() data: MessageUpdateDto,
  ) {
    const message = await this.messagesService.findById(id);
    if (!message || message.authorId !== userId) throw new ForbiddenException();
    if (data.offer) return this.messagesService.updateOffer(id, data.offer);
    return this.messagesService.update({
      where: { id },
      data: { content: data.content },
    });
  }

  @Delete(ID_PARAM)
  @ApiForbiddenResponse({
    description: 'Seul l’auteur du message peut le supprimer',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    const message = await this.messagesService.findById(id);
    if (!message || message.authorId !== userId) throw new ForbiddenException();
    return this.messagesService.delete(id);
  }
}
