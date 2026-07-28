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
import { CsrfGuard } from './common/guards/csrf.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AddressesModule } from './addresses/addresses.module';
import { MissionsModule } from './missions/missions.module';
import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MediasModule } from './medias/medias.module';
import { OffersModule } from './offers/offers.module';
import { AppointmentsModule } from './appointments/appointments.module';
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
import { ReportsModule } from './reports/reports.module';
import { BlocksModule } from './blocks/blocks.module';
import { AdminPanelModule } from './admin/admin-panel.module';

@Module({
  imports: [
    // ConfigModule DOIT s'évaluer en premier : son forRoot charge le .env
    // dans process.env de façon synchrone, et AdminPanelModule.forRoot()
    // (juste en dessous) lit process.env.ADMIN_PANEL_PASSWORD à l'évaluation
    // du tableau — inversés, le panel restait désactivé même configuré.
    ConfigModule.forRoot({ isGlobal: true }),
    // Back-office /admin — ne s'enregistre que si ADMIN_PANEL_PASSWORD est posé.
    ...AdminPanelModule.forRoot(),
    EventEmitterModule.forRoot({ global: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    UsersModule,
    AdvertisementsModule,
    AuthModule,
    PackagesModule,
    AddressesModule,
    MissionsModule,
    MessagesModule,
    ConversationsModule,
    MediasModule,
    OffersModule,
    AppointmentsModule,
    ProofModule,
    EmailModule,
    PhoneModule,
    IdentityModule,
    TransactionsModule,
    ChatModule,
    RatingsModule,
    DisputesModule,
    ReportsModule,
    BlocksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // CSRF en premier : rejette une requête cross-site (cookie de session +
    // origine étrangère) avant tout traitement d'auth.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthenticateGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
