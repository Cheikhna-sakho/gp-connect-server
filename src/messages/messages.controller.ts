import {
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Body,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { UUID } from 'crypto';
import { ConversationsService } from 'src/conversations/conversations.service';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { CreateMessageDto } from './dtos/message.dto';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Get(`'by-conversation/${SetIdParam('conversationId')}`)
  getConversationMessage(@Param('conversationId') conversationId: UUID) {
    return this.messagesService.find({
      conversationId: conversationId,
    });
  }

  @Post()
  async create(@GetUserId() authorId: UUID, @Body() data: CreateMessageDto) {
    data.authorId = authorId;
    const message = await this.messagesService.create(data);
    await this.conversationsService.update({
      where: { id: data.conversationId },
      data: { lastMessage: { connect: { id: message.id } } },
    });
    return message;
  }

  @Patch(`${ID_PARAM}/content`)
  update(@Param('id') id: UUID, @Body() content: string) {
    return this.messagesService.update({
      where: { id },
      data: { content },
    });
  }

  @Delete(ID_PARAM)
  delete(@Param('id') id: UUID) {
    return this.messagesService.delete(id);
  }
}
