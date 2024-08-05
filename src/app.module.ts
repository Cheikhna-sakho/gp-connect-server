import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AdvertisementsModule } from './advertisements/advertisements.module';
import { AuthModule } from './auth/auth.module';
import { PackagesModule } from './packages/packages.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticateGuard } from './auth/guards/auth.guard';
import { AddressesModule } from './addresses/addresses.module';
import { MissionsModule } from './missions/missions.module';
import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MediasModule } from './medias/medias.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    AdvertisementsModule,
    AuthModule,
    PackagesModule,
    AddressesModule,
    MissionsModule,
    MessagesModule,
    ConversationsModule,
    CloudinaryModule,
    MediasModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseService,
    {
      provide: APP_GUARD,
      useClass: AuthenticateGuard,
    },
  ],
})
export class AppModule {}
