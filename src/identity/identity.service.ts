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
    } else if (event.kind === 'canceled') {
      // Une session annulée révoque le badge KYC : sans ça, un `canceled`
      // reçu après un `verified` laissait `idCardVerifiedAt` posé et le
      // gating (OffersService.accept) ouvert.
      await this.databaseService.$transaction([
        this.userIdentity.upsert({
          where: {
            userId_provider: {
              userId,
              provider: UserIdentityProvider.STRIPE_IDENTITY,
            },
          },
          update: {
            status: UserIdentityStatus.CANCELED,
            providerId: sessionId,
          },
          create: {
            userId,
            provider: UserIdentityProvider.STRIPE_IDENTITY,
            status: UserIdentityStatus.CANCELED,
            providerId: sessionId,
          },
        }),
        this.databaseService.user.update({
          where: { id: userId },
          data: { idCardVerifiedAt: null },
        }),
      ]);
    } else {
      await this.upsertStatus({
        status: UserIdentityStatus.REQUIRES_INPUT,
        providerId: sessionId,
        userId,
        reason: event.reason,
      });
    }

    return { received: true };
  }

  /**
   * Droit à l'effacement — à appeler AVANT la suppression du compte.
   * Les pièces d'identité ne sont pas stockées chez nous mais chez le
   * provider ; `providerId` est le seul lien vers elles, et il part en
   * cascade avec le compte. Ne pas purger ici = documents orphelins chez le
   * provider, définitivement (plus aucun identifiant pour les retrouver).
   */
  async redactUserData(userId: string) {
    const sessions = await this.userIdentity.findMany({
      where: { userId },
      select: { providerId: true },
    });
    for (const { providerId } of sessions) {
      if (!providerId) continue;
      try {
        await this.verifier.redactSession(providerId);
      } catch (e) {
        // Une panne du provider ne doit pas empêcher un utilisateur de
        // supprimer son compte. L'identifiant est loggué en ERROR : c'est
        // le seul moyen de purger a posteriori une fois la ligne effacée.
        this.logger.error(
          `Purge identité ${providerId} échouée (user ${userId}) — purge manuelle requise chez le provider`,
          e instanceof Error ? e.stack : undefined,
        );
      }
    }
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
