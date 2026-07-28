import { Logger } from '@nestjs/common';
import {
  DisputeResolutionData,
  DisputeTicketData,
  DisputeTrackerPort,
} from '../dispute-tracker.port';

type GithubIssuesConfig = {
  token: string;
  /** "owner/repo" */
  repo: string;
};

/**
 * Tracker de litiges sur GitHub Issues (repo privé).
 *
 * PII minimale volontaire : IDs, raison et description — jamais les noms ou
 * emails des parties (pas de données personnelles chez un tiers).
 */
export class GithubIssuesTracker implements DisputeTrackerPort {
  private readonly logger = new Logger(GithubIssuesTracker.name);

  constructor(private readonly config: GithubIssuesConfig) {}

  async openTicket(data: DisputeTicketData): Promise<string> {
    const title = `Litige « ${data.reason} » — mission ${data.missionId}`;
    const body = [
      `**Mission** : \`${data.missionId}\``,
      `**Litige** : \`${data.disputeId}\``,
      `**Ouvert par** : ${data.openedBy === 'shipper' ? 'l’expéditeur' : 'le transporteur'}`,
      `**Raison** : ${data.reason}`,
      '',
      '**Description**',
      data.description ?? '_(aucune)_',
      '',
      '---',
      '_Résolution via l’API : `PATCH /disputes/:id` (l’issue n’est qu’un canal de suivi)._',
    ].join('\n');

    const res = await fetch(
      `https://api.github.com/repos/${this.config.repo}/issues`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ title, body, labels: ['litige', data.reason] }),
      },
    );
    if (!res.ok) {
      throw new Error(`GitHub ${res.status} : ${await res.text()}`);
    }
    const issue = (await res.json()) as { html_url: string; number: number };
    this.logger.log(`Issue litige créée : ${issue.html_url}`);
    return String(issue.number);
  }

  /**
   * Commentaire avec le texte de la résolution, puis fermeture. Deux appels
   * indépendants — si le commentaire échoue, on tente quand même la
   * fermeture (l'important est que l'issue ne reste pas ouverte à tort).
   */
  async closeTicket(data: DisputeResolutionData): Promise<void> {
    const base = `https://api.github.com/repos/${this.config.repo}/issues/${data.ticketId}`;
    const comment = await fetch(`${base}/comments`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        body: [
          '**Litige résolu via l’app.**',
          `**Mission** : ${data.missionOutcome === 'COMPLETED' ? 'terminée' : 'annulée'}`,
          '',
          '**Résolution**',
          data.resolution,
        ].join('\n'),
      }),
    });
    if (!comment.ok) {
      this.logger.warn(
        `Commentaire de résolution non posté (GitHub ${comment.status})`,
      );
    }

    const close = await fetch(base, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
    if (!close.ok) {
      throw new Error(`GitHub ${close.status} : ${await close.text()}`);
    }
    this.logger.log(`Issue litige #${data.ticketId} fermée`);
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
  }
}
