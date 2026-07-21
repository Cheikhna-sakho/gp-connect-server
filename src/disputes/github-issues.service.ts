import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Canal de suivi des litiges : une issue GitHub par litige dans un repo privé
 * (notifications, labels, commentaires — un back-office gratuit, sans UI à
 * construire). La résolution reste côté app (PATCH /disputes/:id) : l'issue
 * n'est qu'un canal de notification/suivi, pas la source de vérité.
 *
 * PII minimale volontaire : IDs, raison et description — jamais les noms ou
 * emails des parties (pas de données personnelles chez un tiers).
 */
@Injectable()
export class GithubIssuesService {
  private readonly logger = new Logger(GithubIssuesService.name);

  constructor(private readonly config: ConfigService) {}

  // Même politique que les emails : rien ne part hors production-like.
  private get isDisabled() {
    const env = this.config.get('NODE_ENV');
    return env === 'development' || env === 'test';
  }

  async createDisputeIssue(data: {
    disputeId: string;
    missionId: string;
    reason: string;
    description?: string | null;
    openedBy: 'shipper' | 'carrier';
  }) {
    const token = this.config.get<string>('GITHUB_ISSUES_TOKEN');
    const repo = this.config.get<string>('GITHUB_ISSUES_REPO'); // "owner/repo"

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

    if (this.isDisabled || !token || !repo) {
      this.logger.log(`Issue litige (non envoyée) : ${title}`);
      return;
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels: ['litige', data.reason] }),
    });
    if (!res.ok) {
      throw new Error(`GitHub ${res.status} : ${await res.text()}`);
    }
    const issue = (await res.json()) as { html_url: string };
    this.logger.log(`Issue litige créée : ${issue.html_url}`);
    return issue.html_url;
  }
}
