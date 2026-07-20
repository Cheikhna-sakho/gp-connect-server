import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

const ORIGIN = 'https://app.example';

const makeCtx = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

const reqOf = (over: Record<string, unknown> = {}) => ({
  method: 'POST',
  headers: {},
  cookies: {},
  ...over,
});

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeAll(() => {
    process.env.FRONTEND_URL = ORIGIN;
  });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new CsrfGuard(reflector as never);
  });

  const run = (req: Record<string, unknown>) => guard.canActivate(makeCtx(req));

  it('méthode sûre (GET) → autorisé', () => {
    expect(run(reqOf({ method: 'GET' }))).toBe(true);
  });

  it('route @SkipCsrf → autorisé', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(
      run(
        reqOf({
          headers: { origin: 'https://evil.example' },
          cookies: { at: 'x' },
        }),
      ),
    ).toBe(true);
  });

  it('Bearer (credential non-ambient) → autorisé même avec cookie + origine étrangère', () => {
    expect(
      run(
        reqOf({
          headers: {
            authorization: 'Bearer tok',
            origin: 'https://evil.example',
          },
          cookies: { at: 'x' },
        }),
      ),
    ).toBe(true);
  });

  it('pas de cookie de session (login, webhook…) → autorisé', () => {
    expect(run(reqOf({ headers: { origin: 'https://evil.example' } }))).toBe(
      true,
    );
  });

  it('cookie de session + origine = front → autorisé', () => {
    expect(
      run(reqOf({ headers: { origin: ORIGIN }, cookies: { at: 'x' } })),
    ).toBe(true);
  });

  it('cookie de session + origine étrangère → 403 (CSRF bloqué)', () => {
    expect(() =>
      run(
        reqOf({
          headers: { origin: 'https://evil.example' },
          cookies: { at: 'x' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('cookie de session + aucune origine ni referer → 403', () => {
    expect(() => run(reqOf({ cookies: { rt: 'x' } }))).toThrow(
      ForbiddenException,
    );
  });

  it('cookie de session + referer du front → autorisé', () => {
    expect(
      run(
        reqOf({
          headers: { referer: `${ORIGIN}/messages` },
          cookies: { at: 'x' },
        }),
      ),
    ).toBe(true);
  });
});
