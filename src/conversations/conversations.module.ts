import { forwardRef, Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AdvertisementsModule } from 'src/advertisements/advertisements.module';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
  providers: [ConversationsService],
  controllers: [ConversationsController],
  imports: [
    DatabaseModule,
    AdvertisementsModule,
    forwardRef(() => MessagesModule),
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
