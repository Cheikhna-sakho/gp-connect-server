import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { UUID } from 'crypto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
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
  @Serialize(ConversationEntity)
  getAll(@GetUserId() userId: UUID) {
    return this.conversationsService.findAll(userId);
  }

  @Get(`advertisement/${SetIdParam('advertisementId')}`)
  getExist(
    @GetUserId() userId: UUID,
    @Param('advertisementId') advertisementId: UUID,
  ) {
    return this.conversationsService.findByAdvertisement(
      advertisementId,
      userId,
    );
  }

  @Get(ID_PARAM)
  @Serialize(ConversationEntity)
  async getById(@GetUserId() userId: UUID, @Param('id') id: UUID) {
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
    const payload =
      type === 'DELIVERY'
        ? {
            shipperId: userId,
            carrierId: authorId,
          }
        : {
            shipperId: authorId,
            carrierId: userId,
          };
    return this.conversationsService.create({ ...data, ...payload });
  }

  @Delete(ID_PARAM)
  delete(@Param('id') id: UUID) {
    return this.conversationsService.delete(id);
  }
}
