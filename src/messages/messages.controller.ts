import {
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Body,
  // UseInterceptors,
  // UploadedFile,
  // ParseFilePipe,
  // FileTypeValidator,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { UUID } from 'crypto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { CreateMessageDto } from './dtos/message.dto';
import { ConversationsService } from 'src/conversations/conversations.service';
import { MessageUpdateDto } from './dtos/message-update.dto';
// import { FilesInterceptor } from '@nestjs/platform-express';

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
  async create(
    @GetUserId() authorId: UUID,
    @Body() { advertisementId, ...data }: CreateMessageDto,
  ) {
    data.authorId = authorId;
    if (!data.conversationId) {
      ({ id: data.conversationId } =
        await this.conversationsService.createIfNotExist({
          advertisementId: advertisementId,
          initiatorId: authorId,
        }));
    }
    return this.messagesService.create(data);
  }

  // @Post('vocal')
  // @UseInterceptors(FilesInterceptor('vocal'))
  // async createAudio(
  //   @UploadedFile(
  //     new ParseFilePipe({
  //       validators: [new FileTypeValidator({ fileType: /^audio/ })],
  //     }),
  //   )
  //   vocal: Express.Multer.File,
  // ) {
  //   return this.messagesService.createAudio(vocal);
  // }

  @Patch(`${ID_PARAM}`)
  update(@Param('id') id: UUID, @Body() data: MessageUpdateDto) {
    if (data.offer) return this.messagesService.updateOffer(id, data.offer);
    return this.messagesService.update({
      where: { id },
      data: data as Omit<MessageUpdateDto, 'offer'>,
    });
  }

  @Delete(ID_PARAM)
  delete(@Param('id') id: UUID) {
    return this.messagesService.delete(id);
  }
}
