import { UnauthorizedException } from '@nestjs/common';
import { VerificationTokenType } from '@prisma/client';
import { AuthService } from './auth.service';

// Unité pure : UsersService / JwtService / DatabaseService / ConfigService mockés.
// Cible : résolution d'identifiant, vérification OTP, signature RS256, register,
// et la logique de liaison OAuth (findByIdentifier, verifyOtpToken, providers).

const makeUsers = () => ({
  findByIdentifier: jest.fn(),
  updateById: jest.fn().mockResolvedValue(undefined),
  create: jest.fn(),
  findOne: jest.fn(),
});

const makeVerification = () => ({
  sendEmailOpt: jest.fn().mockResolvedValue(undefined),
  sendPhoneVerification: jest.fn().mockResolvedValue(undefined),
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  verifyOtpToken: jest.fn().mockResolvedValue(undefined),
});

const makeDb = () => ({
  userProvider: { findUnique: jest.fn(), create: jest.fn() },
});

describe('AuthService', () => {
  let users: ReturnType<typeof makeUsers>;
  let verification: ReturnType<typeof makeVerification>;
  let db: ReturnType<typeof makeDb>;
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = makeUsers();
    verification = makeVerification();
    db = makeDb();
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt') };
    config = { get: jest.fn().mockReturnValue('EXP') };
    service = new AuthService(
      users as never,
      verification as never,
      jwt as never,
      db as never,
      config as never,
    );
  });

  describe('login', () => {
    it('Unauthorized si aucun compte pour cet identifiant', async () => {
      users.findByIdentifier.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'x' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("canal EMAIL (défaut) → envoie l'OTP email", async () => {
      users.findByIdentifier.mockResolvedValue({ id: 'u1' });
      await service.login({ identifier: 'a@x.com' } as never);
      expect(verification.sendEmailOpt).toHaveBeenCalledWith('u1');
      expect(verification.sendPhoneVerification).not.toHaveBeenCalled();
    });

    it("canal PHONE → envoie l'OTP SMS", async () => {
      users.findByIdentifier.mockResolvedValue({ id: 'u1' });
      await service.login({
        identifier: '+221770000000',
        sendOptTo: VerificationTokenType.PHONE,
      } as never);
      expect(verification.sendPhoneVerification).toHaveBeenCalledWith('u1');
    });
  });

  describe('loginOpt', () => {
    it('Unauthorized si compte introuvable', async () => {
      users.findByIdentifier.mockResolvedValue(null);
      await expect(
        service.loginOpt({
          identifier: 'x',
          code: '000000',
          type: 'EMAIL',
        } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("vérifie l'OTP (userId+canal) puis renvoie user + tokens", async () => {
      users.findByIdentifier.mockResolvedValue({
        id: 'u1',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: null,
      });

      const res = await service.loginOpt({
        identifier: 'a@x.com',
        code: '123456',
        type: 'EMAIL',
      } as never);

      expect(verification.verifyOtpToken).toHaveBeenCalledWith(
        'u1',
        '123456',
        'EMAIL',
      );
      expect(res.user.id).toBe('u1');
      expect(res.accessToken).toBe('signed.jwt');
      expect(res.refreshToken).toBe('signed.jwt');
    });

    it('marque phoneVerifiedAt à la première vérif SMS', async () => {
      users.findByIdentifier.mockResolvedValue({
        id: 'u1',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      });

      await service.loginOpt({
        identifier: '+221770000000',
        code: '123456',
        type: 'PHONE',
      } as never);

      expect(users.updateById).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ phoneVerifiedAt: expect.any(Date) }),
      );
    });
  });

  describe('register', () => {
    it('crée le compte + envoie la vérif email (SMS seulement si téléphone)', async () => {
      users.create.mockResolvedValue({ id: 'u1', phone: null });
      await service.register({ email: 'a@x.com' } as never);

      expect(verification.sendEmailVerification).toHaveBeenCalledWith('u1');
      expect(verification.sendPhoneVerification).not.toHaveBeenCalled();
    });

    it('envoie aussi la vérif SMS si un téléphone est renseigné', async () => {
      users.create.mockResolvedValue({ id: 'u1', phone: '+221770000000' });
      await service.register({
        email: 'a@x.com',
        phone: '+221770000000',
      } as never);
      expect(verification.sendPhoneVerification).toHaveBeenCalledWith('u1');
    });
  });

  describe('signature JWT', () => {
    it('access token signé en RS256', () => {
      service.signAccessTokenJwt({ id: 'u1' } as never);
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 'u1' },
        expect.objectContaining({ algorithm: 'RS256' }),
      );
    });

    it('signTokenPair renvoie les deux tokens', async () => {
      const pair = await service.signTokenPair('u1');
      expect(pair).toEqual({
        accessToken: 'signed.jwt',
        refreshToken: 'signed.jwt',
      });
    });
  });

  describe('validateOAuthLogin — liaison de compte', () => {
    const profile = { providerUserId: 'g-123', email: 'a@x.com' } as never;

    it('provider déjà lié → renvoie son user (aucune création)', async () => {
      db.userProvider.findUnique.mockResolvedValue({ user: { id: 'u1' } });

      const user = await service.validateOAuthLogin(profile, 'GOOGLE' as never);

      expect(user).toEqual({ id: 'u1' });
      expect(users.create).not.toHaveBeenCalled();
      expect(db.userProvider.create).not.toHaveBeenCalled();
    });

    it('email connu + VÉRIFIÉ → lie au compte existant', async () => {
      db.userProvider.findUnique.mockResolvedValue(null);
      users.findOne.mockResolvedValue({ id: 'u2' });

      const user = await service.validateOAuthLogin(
        profile,
        'GOOGLE' as never,
        true,
      );

      expect(user).toEqual({ id: 'u2' });
      expect(users.create).not.toHaveBeenCalled();
      expect(db.userProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u2' }),
        }),
      );
    });

    it('email connu mais NON vérifié → refuse la liaison automatique (401)', async () => {
      db.userProvider.findUnique.mockResolvedValue(null);
      users.findOne.mockResolvedValue({ id: 'u2' });

      await expect(
        service.validateOAuthLogin(profile, 'GOOGLE' as never, false),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(db.userProvider.create).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    });

    it('ni provider ni user → crée le compte puis le provider', async () => {
      db.userProvider.findUnique.mockResolvedValue(null);
      users.findOne.mockResolvedValue(null);
      users.create.mockResolvedValue({ id: 'u3' });

      const user = await service.validateOAuthLogin(profile, 'GOOGLE' as never);

      expect(users.create).toHaveBeenCalled();
      expect(db.userProvider.create).toHaveBeenCalled();
      expect(user).toEqual({ id: 'u3' });
    });

    it("nouveau compte : emailVerifiedAt posé seulement si le provider atteste l'email vérifié", async () => {
      db.userProvider.findUnique.mockResolvedValue(null);
      users.findOne.mockResolvedValue(null);
      users.create.mockResolvedValue({ id: 'u3' });

      await service.validateOAuthLogin(profile, 'GOOGLE' as never, false);
      expect(users.create.mock.calls[0][0].data.emailVerifiedAt).toBeNull();

      users.create.mockClear();
      await service.validateOAuthLogin(profile, 'GOOGLE' as never, true);
      expect(users.create.mock.calls[0][0].data.emailVerifiedAt).toBeInstanceOf(
        Date,
      );
    });
  });

  describe('fail-closed : provider non configuré', () => {
    it('Apple sans APPLE_CLIENT_ID → 401 (audience non vérifiable)', async () => {
      config.get.mockReturnValue(undefined);
      await expect(service.validateAppleToken('a.b.c')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('Facebook sans FACEBOOK_APP_ID/SECRET → 401 (token non vérifiable)', async () => {
      config.get.mockReturnValue(undefined);
      await expect(
        service.validateFacebookToken('token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
