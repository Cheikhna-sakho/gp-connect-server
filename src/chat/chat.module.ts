import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { DatabaseModule } from 'src/database/database.module';
import { MessagesModule } from 'src/messages/messages.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    DatabaseModule,
    MessagesModule,
    JwtModule.register({}), // options passed per verify() call
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
