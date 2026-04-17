import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserIdentityProvider } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import Stripe from 'stripe';

type ValueOf<T> = T[keyof T];
type EventType = Extract<
  Stripe.Event.Type,
  | 'identity.verification_session.verified'
  | 'identity.verification_session.requires_input'
  | 'identity.verification_session.canceled'
>;
export const STRIPE_EVENT_TYPE = {
  'identity.verification_session.verified': 'verified',
  'identity.verification_session.requires_input': 'requires_input',
  'identity.verification_session.canceled': 'canceled',
} satisfies Record<EventType, 'verified' | 'requires_input' | 'canceled'>;
export const IDENTITY_EVENT_TYPE = {
  ...STRIPE_EVENT_TYPE,
  MISSING_USER_METADATA: 'missing_user',
} as const;

export type StripeEventType = ValueOf<typeof STRIPE_EVENT_TYPE>;

@Injectable()
export class IdentityService {
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

  async createVerificationSession(userId: string) {
    // tu peux aussi lier le user à un customer Stripe si tu veux
    const session = await this.stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        userId,
      },
      options: {
        document: {
          allowed_types: ['id_card', 'passport', 'driving_license'],
        },
      },
      // si tu veux gérer redirect côté front web
      return_url: this.config.get('STRIPE_IDENTITY_RETURN_URL') || undefined,
    });

    await this.updateVerifyStatus({
      status: 'PENDING',
      providerId: session.id,
      userId,
    });

    // tu peux renvoyer soit l'URL hébergée, soit client_secret si tu intègres côté front
    return {
      id: session.id,
      url: (session as any).url ?? null, // session.url si tu utilises l'hébergement Stripe
      clientSecret: session.client_secret,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const webhookSecret = this.config.get<string>(
      'STRIPE_WEBHOOK_SECRET_IDENTITY',
    );
    if (!webhookSecret) {
      // this.logger.error('Stripe Identity webhook secret not configured');
      return;
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature!,
        webhookSecret,
      );
    } catch (err: any) {
      // this.logger.error(
      //   'Error verifying Stripe webhook signature',
      //   err.message,
      // );
      throw err;
    }

    if (Object.keys(STRIPE_EVENT_TYPE).includes(event.type)) {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const userId = session.metadata?.userId;

      if (!userId) {
        // this.logger.warn('Verification session without userId metadata');
        return;
      }

      if (event.type === 'identity.verification_session.verified') {
        await this.updateVerifyStatus({
          status: 'VERIFIED',
          providerId: session.id,
          userId,
        });
        await this.databaseService.user.update({
          where: { id: userId },
          data: { idCardVerifiedAt: new Date() },
        });
      } else if (
        event.type === 'identity.verification_session.requires_input'
      ) {
        await this.updateVerifyStatus({
          status: 'REJECTED',
          providerId: session.id,
          userId,
          reason: session.last_error?.reason ?? 'requires_input',
        });
      } else if (event.type === 'identity.verification_session.canceled') {
        await this.updateVerifyStatus({
          status: 'CANCELED',
          providerId: session.id,
          userId,
          reason: session.last_error?.reason ?? 'canceled',
        });
      }
    }
    return { received: true };
  }
  async updateVerifyStatus({
    userId,
    ...data
  }: Omit<Prisma.UserIdentityUncheckedCreateInput, 'provider'>) {
    return this.userIdentity.upsert({
      where: {
        userId_provider: {
          userId,
          provider: UserIdentityProvider.STRIPE_IDENTITY,
        },
      },
      create: {
        userId,
        ...data,
        provider: UserIdentityProvider.STRIPE_IDENTITY,
      },
      update: data,
    });
  }
}
