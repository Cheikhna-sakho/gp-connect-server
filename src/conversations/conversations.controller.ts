import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { UUID } from 'crypto';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { ConversationEntity } from './entities/conversation.entity';
import { CreateConversationDto } from './dtos/create-conversation.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @Serialize(ConversationEntity)
  getAll(@GetUserId() userId: UUID) {
    return this.conversationsService.findAll({
      OR: [{ shipperId: userId }, { carrierId: userId }],
    });
  }

  @Get(ID_PARAM)
  @Serialize(ConversationEntity)
  async getById(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    return this.conversationsService.findBy({ id }); //bug a corriger sinon un autre utilisateur aura accs a une conv
  }
  @Get('by')
  @Serialize(ConversationEntity)
  async getByAdvertisement(
    @GetUserId() currentUserId: UUID,
    @Query()
    query: { advertisementId?: UUID; conversationId?: UUID; userId?: UUID },
  ) {
    const { advertisementId, conversationId: id, userId } = query ?? {};
    if (!advertisementId && !id) {
      throw new BadRequestException(
        'advertisementId or conversationId should be defined',
      );
    }
    if (advertisementId && !userId) {
      throw new BadRequestException('advertisementId should be with userId');
    }

    return this.conversationsService.findOne({
      id,
      advertisementId,
      OR: [
        { shipperId: userId, carrierId: currentUserId },
        { shipperId: currentUserId, carrierId: userId },
      ],
    });
  }
  @Post()
  @Serialize(ConversationEntity)
  create(@Body() data: CreateConversationDto) {
    const { advertisementId, shipperId, carrierId } = data;
    return this.conversationsService.create({
      advertisement: { connect: { id: advertisementId } },
      shipper: { connect: { id: shipperId } },
      carrier: { connect: { id: carrierId } },
    });
  }

  @Delete(ID_PARAM)
  delete(@Param('id') id: UUID) {
    return this.conversationsService.delete(id);
  }
}
