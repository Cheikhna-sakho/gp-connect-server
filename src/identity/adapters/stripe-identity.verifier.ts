import Stripe from 'stripe';
import {
  IdentityVerifierPort,
  IdentityWebhookEvent,
  InvalidWebhookSignatureError,
  VerificationSession,
  WebhookNotConfiguredError,
} from '../identity-verifier.port';

type StripeIdentityConfig = {
  secretKey: string;
  webhookSecret?: string;
  returnUrl?: string;
};

const KIND_BY_EVENT: Record<
  string,
  'verified' | 'requires_input' | 'canceled'
> = {
  'identity.verification_session.verified': 'verified',
  'identity.verification_session.requires_input': 'requires_input',
  'identity.verification_session.canceled': 'canceled',
};

export class StripeIdentityVerifier implements IdentityVerifierPort {
  private readonly stripe: Stripe;

  constructor(private readonly config: StripeIdentityConfig) {
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2025-11-17.clover',
    });
  }

  async createSession(userId: string): Promise<VerificationSession> {
    const session = await this.stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId },
      options: {
        document: { allowed_types: ['id_card', 'passport', 'driving_license'] },
      },
      return_url: this.config.returnUrl || undefined,
    });
    return {
      id: session.id,
      url: session.url ?? null,
      clientSecret: session.client_secret,
    };
  }

  parseWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): IdentityWebhookEvent {
    if (!this.config.webhookSecret) throw new WebhookNotConfiguredError();

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody!,
        signature!,
        this.config.webhookSecret,
      );
    } catch (err: any) {
      throw new InvalidWebhookSignatureError(err.message);
    }

    const kind = KIND_BY_EVENT[event.type];
    if (!kind) return { kind: 'ignored' };

    const session = event.data.object as Stripe.Identity.VerificationSession;
    const base = { sessionId: session.id, userId: session.metadata?.userId };
    if (kind === 'verified') return { kind, ...base };
    return { kind, ...base, reason: session.last_error?.reason ?? kind };
  }
}
