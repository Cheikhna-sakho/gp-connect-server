// Port de vérification d'identité : le domaine (IdentityService) ne dépend
// que de ce contrat. Le provider concret (Stripe Identity, demain Onfido,
// Ubble…) est un adapter branché dans IdentityModule — il vérifie la
// signature du webhook et le traduit en événement du domaine.
export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');

export interface VerificationSession {
  id: string;
  url: string | null;
  clientSecret: string | null;
}

/** Événement webhook ramené au vocabulaire du domaine. */
export type IdentityWebhookEvent =
  | { kind: 'verified'; sessionId: string; userId?: string }
  | {
      kind: 'requires_input' | 'canceled';
      sessionId: string;
      userId?: string;
      reason: string;
    }
  | { kind: 'ignored' };

export class WebhookNotConfiguredError extends Error {}
export class InvalidWebhookSignatureError extends Error {}

export interface IdentityVerifierPort {
  createSession(userId: string): Promise<VerificationSession>;
  /**
   * Vérifie l'authenticité du webhook et le traduit.
   * @throws WebhookNotConfiguredError | InvalidWebhookSignatureError
   */
  parseWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): IdentityWebhookEvent;
  /**
   * Purge chez le provider les données d'identité d'une session (pièce
   * d'identité scannée) — droit à l'effacement RGPD. Les documents ne
   * transitent jamais par nos serveurs : c'est le SEUL moyen de les effacer.
   */
  redactSession(sessionId: string): Promise<void>;
}
