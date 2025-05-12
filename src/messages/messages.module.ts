import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { DatabaseModule } from 'src/database/database.module';
import { ConversationsModule } from 'src/conversations/conversations.module';
import { AdvertisementsModule } from 'src/advertisements/advertisements.module';
import { MediasModule } from 'src/medias/medias.module';

@Module({
  imports: [
    DatabaseModule,
    ConversationsModule,
    AdvertisementsModule,
    MediasModule,
  ],
  providers: [MessagesService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
