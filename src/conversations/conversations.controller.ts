import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { UUID } from 'crypto';
import { ConversationStatus } from '@prisma/client';
import { AdvertisementsService } from 'src/advertisements/advertisements.service';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly advertisementsService: AdvertisementsService,
  ) {}

  @Get()
  getAll(@GetUserId() userId: UUID) {
    return this.conversationsService.find({
      participants: { some: { userId: userId } },
    });
  }
  @Get(`${ID_PARAM}/messages`)
  getMessages(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    return this.conversationsService.findMessages(id, userId);
  }
  @Get(`advertisements/${SetIdParam('advertisementId')}/messages`)
  async getMessagesByAdvertisement(
    @GetUserId() userId: UUID,
    @Param('advertisementId') advertisementId: UUID,
  ) {
    const messages = await this.conversationsService.findOne({
      advertisementId,
      participants: { some: { userId } },
    });
    if (messages) {
      return messages;
    }
    const advertisement = await this.advertisementsService.findOne({
      where: { id: advertisementId },
      select: { authorId: true },
    });
    if (!advertisement) return null;
    return this.conversationsService.create(
      {
        participants: {
          create: [{ userId }, { userId: advertisement.authorId }],
        },
        advertisement: { connect: { id: advertisementId } },
      },
      { messages: true, participants: true },
    );
  }
  @Post()
  create(@GetUserId() userId: UUID, @Body() data: any) {
    return this.conversationsService.create({
      participants: { create: [{ userId }, { userId: data.receiverId }] },
      advertisement: { connect: { id: data.advertisementId } },
    });
  }
  @Patch(`${ID_PARAM}/status`)
  update(
    @GetUserId() userId: UUID,
    @Param('id') id: UUID,
    @Body() status: ConversationStatus,
  ) {
    return this.conversationsService.update({
      where: { id, participants: { some: { userId } } },
      data: { status },
    });
  }
  @Delete(ID_PARAM)
  delete(@Param('id') id: UUID) {
    return this.conversationsService.delete(id);
  }
}
