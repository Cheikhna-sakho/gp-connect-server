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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const { method, url, body, ip } = req;
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
