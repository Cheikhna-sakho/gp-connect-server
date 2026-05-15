import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AdvertisementsModule } from './advertisements/advertisements.module';
import { AuthModule } from './auth/auth.module';
import { PackagesModule } from './packages/packages.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticateGuard } from './auth/guards/auth.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { TransactionsModule } from './transactions/transactions.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ChatModule } from './chat/chat.module';
import { RatingsModule } from './ratings/ratings.module';
import { DisputesModule } from './disputes/disputes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ global: true }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
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
    TransactionsModule,
    ChatModule,
    RatingsModule,
    DisputesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AuthenticateGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
