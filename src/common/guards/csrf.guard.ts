import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

// Méthodes sans effet de bord → aucun risque CSRF.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF adaptée à un déploiement cross-site (SPA sur un domaine, API
 * sur un autre) où les cookies de session sont `SameSite=None` en prod — donc
 * la protection SameSite ne joue plus.
 *
 * Le CSRF n'exploite que des credentials **ambient** (les cookies envoyés
 * automatiquement par le navigateur). On n'enforce donc l'origine QUE pour les
 * requêtes mutantes qui s'appuient sur le cookie de session :
 *   - Bearer (Authorization) → credential non-ambient (mobile / API / tests) → OK ;
 *   - pas de cookie de session → aucune session détournée → OK (login, webhook…) ;
 *   - cookie de session présent → l'`Origin`/`Referer` doit être notre front.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  // Normalisé en origine pure : un FRONTEND_URL avec slash final ou chemin ne
  // doit pas casser la comparaison `=== req.headers.origin` (jamais suffixé).
  private readonly allowedOrigin = normalizeOrigin(
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
  );

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Guard global : ne s'applique qu'au HTTP. En contexte WebSocket/RPC,
    // `getRequest()` renvoie le Socket (pas de method/headers) → on laisse
    // passer (le gateway porte sa propre auth + garde CSWSH).
    if (ctx.getType() !== 'http') return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return true;
    }

    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const hasSessionCookie = !!(cookies?.at || cookies?.rt);
    if (!hasSessionCookie) return true;

    // Requête authentifiée par cookie : exiger une origine légitime.
    const origin = req.headers.origin;
    if (origin) {
      if (origin === this.allowedOrigin) return true;
      throw new ForbiddenException('Cross-site request blocked');
    }
    const referer = req.headers.referer;
    // Comparaison d'ORIGINE parsée, pas de préfixe : `https://app.tld.evil.com`
    // ne doit pas matcher `https://app.tld`.
    if (referer && safeOrigin(referer) === this.allowedOrigin) return true;

    throw new ForbiddenException('Missing or invalid origin');
  }
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function safeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
