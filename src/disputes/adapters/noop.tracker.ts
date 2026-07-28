import { Logger } from '@nestjs/common';
import {
  DisputeResolutionData,
  DisputeTicketData,
  DisputeTrackerPort,
} from '../dispute-tracker.port';

/**
 * Adapter hors production-like (même politique que les emails) ou tracker
 * non configuré : rien ne part, tout est loggé.
 */
export class NoopDisputeTracker implements DisputeTrackerPort {
  private readonly logger = new Logger('DisputeTracker');

  async openTicket(data: DisputeTicketData): Promise<null> {
    this.logger.log(
      `Ticket litige (non envoyé) — mission ${data.missionId}, raison ${data.reason}`,
    );
    return null;
  }

  async closeTicket(data: DisputeResolutionData): Promise<void> {
    this.logger.log(`Ticket litige #${data.ticketId} (fermeture non envoyée)`);
  }
}
