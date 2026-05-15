import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserIdentityProvider, UserIdentityStatus } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import Stripe from 'stripe';

type IdentityEventType = Extract<
  Stripe.Event.Type,
  | 'identity.verification_session.verified'
  | 'identity.verification_session.requires_input'
  | 'identity.verification_session.canceled'
>;

const HANDLED_EVENTS = new Set<IdentityEventType>([
  'identity.verification_session.verified',
  'identity.verification_session.requires_input',
  'identity.verification_session.canceled',
]);

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private stripe: Stripe;
  private userIdentity: DatabaseService['userIdentity'];

  constructor(
    private readonly config: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-11-17.clover',
    });
    this.userIdentity = this.databaseService.userIdentity;
  }

  async getStatus(userId: string) {
    return this.userIdentity.findUnique({
      where: {
        userId_provider: { userId, provider: UserIdentityProvider.STRIPE_IDENTITY },
      },
      select: { status: true, reason: true, createdAt: true, updatedAt: true },
    });
  }

  async createVerificationSession(userId: string) {
    const existing = await this.userIdentity.findUnique({
      where: { userId_provider: { userId, provider: UserIdentityProvider.STRIPE_IDENTITY } },
      select: { status: true },
    });

    if (existing?.status === UserIdentityStatus.VERIFIED) {
      throw new BadRequestException('Identity is already verified');
    }

    const session = await this.stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId },
      options: {
        document: { allowed_types: ['id_card', 'passport', 'driving_license'] },
      },
      return_url: this.config.get('STRIPE_IDENTITY_RETURN_URL') || undefined,
    });

    await this.upsertStatus({
      status: UserIdentityStatus.PENDING,
      providerId: session.id,
      userId,
    });

    return {
      id: session.id,
      url: session.url ?? null,
      clientSecret: session.client_secret,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET_IDENTITY');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET_IDENTITY is not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature!, webhookSecret);
    } catch (err: any) {
      this.logger.error('Webhook signature verification failed', err.message);
      throw new BadRequestException('Invalid webhook signature');
    }

    if (!HANDLED_EVENTS.has(event.type as IdentityEventType)) {
      return { received: true };
    }

    const session = event.data.object as Stripe.Identity.VerificationSession;
    const userId = session.metadata?.userId;

    if (!userId) {
      this.logger.warn(`Verification session ${session.id} has no userId in metadata`);
      return { received: true };
    }

    if (event.type === 'identity.verification_session.verified') {
      await this.upsertStatus({ status: UserIdentityStatus.VERIFIED, providerId: session.id, userId });
      await this.databaseService.user.update({
        where: { id: userId },
        data: { idCardVerifiedAt: new Date() },
      });
    } else if (event.type === 'identity.verification_session.requires_input') {
      await this.upsertStatus({
        status: UserIdentityStatus.REQUIRES_INPUT,
        providerId: session.id,
        userId,
        reason: session.last_error?.reason ?? 'requires_input',
      });
    } else if (event.type === 'identity.verification_session.canceled') {
      await this.upsertStatus({
        status: UserIdentityStatus.CANCELED,
        providerId: session.id,
        userId,
        reason: session.last_error?.reason ?? 'canceled',
      });
    }

    return { received: true };
  }

  private async upsertStatus({
    userId,
    status,
    providerId,
    reason,
  }: {
    userId: string;
    status: UserIdentityStatus;
    providerId: string;
    reason?: string;
  }) {
    return this.userIdentity.upsert({
      where: {
        userId_provider: { userId, provider: UserIdentityProvider.STRIPE_IDENTITY },
      },
      create: { userId, provider: UserIdentityProvider.STRIPE_IDENTITY, status, providerId, reason },
      update: { status, providerId, reason },
    });
  }
}
