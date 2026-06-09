import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { UUID } from 'crypto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { SerializePage } from 'src/common/decorators/serialize-page.decorator';
import { ConversationEntity } from './entities/conversation.entity';
import { CreateConversationDto } from './dtos/create-conversation.dto';
import { AdvertisementsService } from 'src/advertisements/advertisements.service';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly advertisementsService: AdvertisementsService,
  ) {}

  @Get()
  @SerializePage(ConversationEntity)
  getAll(
    @GetUserId() userId: UUID,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.conversationsService.findAll(userId, page, limit);
  }

  @Get(`advertisement/${SetIdParam('advertisementId')}`)
  @Serialize(ConversationEntity)
  async getExist(
    @GetUserId() userId: UUID,
    @Param('advertisementId') advertisementId: UUID,
  ) {
    const conv = await this.conversationsService.findByAdvertisement(
      advertisementId,
      userId,
    );
    if (!conv) throw new NotFoundException();
    return conv;
  }

  @Get(ID_PARAM)
  @Serialize(ConversationEntity)
  getById(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    return this.conversationsService.findOne(id, userId);
  }

  @Post()
  @Serialize(ConversationEntity)
  async create(@Body() data: CreateConversationDto, @GetUserId() userId: UUID) {
    const advertisement = await this.advertisementsService.findBy({
      id: data.advertisementId,
    });
    if (!advertisement) throw new NotFoundException();
    const { authorId, type } = advertisement;
    if (authorId === userId)
      throw new ForbiddenException(
        'Cannot start a conversation on your own advertisement',
      );
    const payload =
      type === 'DELIVERY'
        ? { shipperId: userId, carrierId: authorId }
        : { shipperId: authorId, carrierId: userId };

    // Annonce SHIPPING : toutes les conversations partagent la mission-dossier
    // de l'annonce (celle qui porte les colis du shipper). Le carrier y sera
    // assigné à l'acceptation d'une offre. Sans dossier (annonces legacy),
    // on retombe sur la création d'une mission par conversation.
    if (type === 'SHIPPING' && !data.missionId) {
      const dossier = await this.conversationsService.findDossierMission(
        data.advertisementId,
        authorId,
      );
      if (dossier) data.missionId = dossier.id;
    }

    return this.conversationsService.create({ ...data, ...payload });
  }

  @Delete(ID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    const conv = await this.conversationsService.findOne(id, userId);
    if (!conv) throw new ForbiddenException();
    return this.conversationsService.delete(id);
  }
}
