import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'code',
  'otpHash',
  'accessToken',
  'refreshToken',
  'idToken',
  'identityToken',
  'secret',
]);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 3 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return `[Array(${obj.length})]`;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redact(v, depth + 1),
    ]),
  );
}

// Masque la valeur des query params sensibles dans l'URL loggée (le token de
// vérif email transite en query → sinon il finit en clair dans les logs).
const SENSITIVE_QUERY = new Set(['token', 'code', 'secret']);
function redactUrl(url: string): string {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return url;
  const path = url.slice(0, qIndex);
  const params = new URLSearchParams(url.slice(qIndex + 1));
  for (const key of params.keys()) {
    if (SENSITIVE_QUERY.has(key)) params.set(key, '[REDACTED]');
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const { method, body, ip } = req;
    const url = redactUrl(req.url);
    const userId: string | undefined = req.user?.sub;
    const handler = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    const start = Date.now();

    const bodyLog =
      body && Object.keys(body).length
        ? ` body=${JSON.stringify(redact(body))}`
        : '';

    this.logger.log(
      `→ ${method} ${url} | ${userId ? `user:${userId}` : 'anon'} | ip:${ip}${bodyLog} | ${handler}`,
    );

    return next.handle().pipe(
      tap(() => {
        const res = ctx.switchToHttp().getResponse();
        this.logger.log(
          `← ${method} ${url} | ${res.statusCode} | ${Date.now() - start}ms`,
        );
      }),
      catchError((err) => {
        const status = err?.status ?? 500;
        this.logger.error(
          `✕ ${method} ${url} | ${status} | ${Date.now() - start}ms | ${err?.message}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
