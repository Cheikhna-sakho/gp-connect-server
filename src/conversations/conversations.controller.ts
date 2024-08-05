import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Request,
  Param,
  Body,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { AuthRequest } from 'src/common/types/request.type';
import { UUID } from 'crypto';
import { ConversationStatus } from '@prisma/client';
import { AdvertisementsService } from 'src/advertisements/advertisements.service';
import { ROUTE_UUID_REGEX } from 'src/common/constants/route.util.const';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly advertisementsService: AdvertisementsService,
  ) {}

  @Get()
  getAll(@Request() req: AuthRequest) {
    const { id: userId } = req.user;
    return this.conversationsService.find({
      participants: { some: { userId: userId } },
    });
  }
  @Get(`:id(${ROUTE_UUID_REGEX})/messages`)
  getMessages(@Request() req: AuthRequest, @Param('id') id: UUID) {
    const { id: userId } = req.user;
    return this.conversationsService.findMessages(id, userId);
  }
  @Get(`advertisements/:advertisementId(${ROUTE_UUID_REGEX})/messages`)
  async getMessagesByAdvertisement(
    @Request() req: AuthRequest,
    @Param('advertisementId') advertisementId: UUID,
  ) {
    const { id: userId } = req.user;
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
  create(@Request() req: AuthRequest, @Body() data: any) {
    const { id: userId } = req.user;
    return this.conversationsService.create({
      participants: { create: [{ userId }, { userId: data.receiverId }] },
      advertisement: { connect: { id: data.advertisementId } },
    });
  }
  @Patch(':id/status')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: UUID,
    @Body() status: ConversationStatus,
  ) {
    const { id: userId } = req.user;
    return this.conversationsService.update({
      where: { id, participants: { some: { userId } } },
      data: { status },
    });
  }
  @Delete(`:id(${ROUTE_UUID_REGEX})`)
  delete(@Param('id') id: UUID) {
    return this.conversationsService.delete(id);
  }
}
