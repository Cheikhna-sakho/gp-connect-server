// Port du canal de suivi des litiges : un ticket par litige chez un tracker
// externe (notifications, labels, commentaires — un back-office gratuit, sans
// UI à construire). La résolution reste côté app (PATCH /disputes/:id) : le
// ticket n'est qu'un canal de notification/suivi, pas la source de vérité.
// Le provider concret (GitHub Issues, demain Linear/Jira…) est un adapter
// branché dans DisputesModule.
export const DISPUTE_TRACKER = Symbol('DISPUTE_TRACKER');

export interface DisputeTicketData {
  disputeId: string;
  missionId: string;
  reason: string;
  description?: string | null;
  openedBy: 'shipper' | 'carrier';
}

export interface DisputeResolutionData {
  ticketId: string;
  resolution: string;
  missionOutcome: string;
}

export interface DisputeTrackerPort {
  /** Identifiant du ticket chez le provider, ou null si rien n'est parti. */
  openTicket(data: DisputeTicketData): Promise<string | null>;
  closeTicket(data: DisputeResolutionData): Promise<void>;
}
