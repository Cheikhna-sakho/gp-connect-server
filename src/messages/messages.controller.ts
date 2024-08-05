import {
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Body,
  Request,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { UUID } from 'crypto';
import { AuthRequest } from 'src/common/types/request.type';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ROUTE_UUID_REGEX } from 'src/common/constants/route.util.const';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get('by-conversation/:conversationId')
  getConversationMessage(@Param('conversationId') conversationId: UUID) {
    return this.messagesService.find({
      conversationId: conversationId,
    });
  }

  @Post()
  async create(@Request() req: AuthRequest, @Body() data: any) {
    const { id: authorId } = req.user;
    const message = await this.messagesService.create({
      content: data.content,
      conversation: { connect: { id: data.conversationId } },
      author: { connect: { id: authorId } },
      recipient: { connect: { id: data.recipientId } },
    });
    await this.conversationsService.update({
      where: { id: data.conversationId },
      data: { lastMessage: { connect: { id: message.id } } },
    });
    return message;
  }

  @Patch(':id/content')
  update(@Param('id') id: UUID, @Body() content: string) {
    return this.messagesService.update({
      where: { id },
      data: { content },
    });
  }

  @Delete(`:id(${ROUTE_UUID_REGEX})`)
  delete(@Param('id') id: UUID) {
    return this.messagesService.delete(id);
  }
}
