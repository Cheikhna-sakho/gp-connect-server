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
import { OffersModule } from './offers/offers.module';
import { ProofModule } from './proof/proof.module';
import { EmailModule } from './email/email.module';
import { ConfigModule } from '@nestjs/config';
import { PhoneModule } from './phone/phone.module';
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available globally
      // envFilePath: '.env', // Specify the env file path (useful for local dev)
      // In production, environment variables are typically set directly
    }),
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
    OffersModule,
    ProofModule,
    EmailModule,
    PhoneModule,
    IdentityModule,
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
