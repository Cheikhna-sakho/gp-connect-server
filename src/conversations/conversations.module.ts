import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AdvertisementsModule } from 'src/advertisements/advertisements.module';

@Module({
  providers: [ConversationsService],
  controllers: [ConversationsController],
  imports: [DatabaseModule, AdvertisementsModule],
  exports: [ConversationsService],
})
export class ConversationsModule {}
