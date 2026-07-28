import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserIdentityProvider, UserIdentityStatus } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import {
  IDENTITY_VERIFIER,
  IdentityVerifierPort,
  IdentityWebhookEvent,
  WebhookNotConfiguredError,
} from './identity-verifier.port';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private userIdentity: DatabaseService['userIdentity'];

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(IDENTITY_VERIFIER)
    private readonly verifier: IdentityVerifierPort,
  ) {
    this.userIdentity = this.databaseService.userIdentity;
  }

  async getStatus(userId: string) {
    return this.userIdentity.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: UserIdentityProvider.STRIPE_IDENTITY,
        },
      },
      select: { status: true, reason: true, createdAt: true, updatedAt: true },
    });
  }

  async createVerificationSession(userId: string) {
    const existing = await this.userIdentity.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: UserIdentityProvider.STRIPE_IDENTITY,
        },
      },
      select: { status: true },
    });

    if (existing?.status === UserIdentityStatus.VERIFIED) {
      throw new BadRequestException('Identity is already verified');
    }

    const session = await this.verifier.createSession(userId);

    await this.upsertStatus({
      status: UserIdentityStatus.PENDING,
      providerId: session.id,
      userId,
    });

    return session;
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ) {
    let event: IdentityWebhookEvent;
    try {
      event = this.verifier.parseWebhook(rawBody, signature);
    } catch (err) {
      if (err instanceof WebhookNotConfiguredError) {
        this.logger.error('Identity webhook secret is not configured');
        throw new BadRequestException('Webhook secret not configured');
      }
      this.logger.error(
        'Webhook signature verification failed',
        (err as Error).message,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.kind === 'ignored') return { received: true };

    const { sessionId, userId } = event;
    if (!userId) {
      this.logger.warn(
        `Verification session ${sessionId} has no userId in metadata`,
      );
      return { received: true };
    }

    if (event.kind === 'verified') {
      // Atomique : identité VERIFIED sans idCardVerifiedAt laisserait le
      // gating KYC (OffersService.accept) bloquer un transporteur vérifié.
      // (upsert inliné : une méthode async ne renvoie pas un PrismaPromise
      // utilisable dans un $transaction en style tableau.)
      await this.databaseService.$transaction([
        this.userIdentity.upsert({
          where: {
            userId_provider: {
              userId,
              provider: UserIdentityProvider.STRIPE_IDENTITY,
            },
          },
          update: {
            status: UserIdentityStatus.VERIFIED,
            providerId: sessionId,
          },
          create: {
            userId,
            provider: UserIdentityProvider.STRIPE_IDENTITY,
            status: UserIdentityStatus.VERIFIED,
            providerId: sessionId,
          },
        }),
        this.databaseService.user.update({
          where: { id: userId },
          data: { idCardVerifiedAt: new Date() },
        }),
      ]);
    } else {
      await this.upsertStatus({
        status:
          event.kind === 'requires_input'
            ? UserIdentityStatus.REQUIRES_INPUT
            : UserIdentityStatus.CANCELED,
        providerId: sessionId,
        userId,
        reason: event.reason,
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
        userId_provider: {
          userId,
          provider: UserIdentityProvider.STRIPE_IDENTITY,
        },
      },
      create: {
        userId,
        provider: UserIdentityProvider.STRIPE_IDENTITY,
        status,
        providerId,
        reason,
      },
      update: { status, providerId, reason },
    });
  }
}
