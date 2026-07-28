import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserVerificationService } from './user-verification.service';

// Unité pure : dépendances mockées. Tests déplacés de users.service.spec lors
// du split SRP — la politique de vérification email/téléphone vit ici.

const makeDb = () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  verificationToken: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn().mockResolvedValue([]),
});

describe('UserVerificationService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UserVerificationService;

  beforeEach(() => {
    db = makeDb();
    service = new UserVerificationService(
      db as never,
      { sendEmailVerification: jest.fn(), sendEmailOpt: jest.fn() } as never,
      { sendPhoneVerification: jest.fn() } as never,
    );
  });

  describe('verifyEmailToken', () => {
    it('lève BadRequest sur token absent, sans requêter la DB', async () => {
      await expect(service.verifyEmailToken('')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.verifyEmailToken(undefined as unknown as string),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.verificationToken.findFirst).not.toHaveBeenCalled();
    });

    it('lève BadRequest quand aucun enregistrement ne correspond', async () => {
      db.verificationToken.findFirst.mockResolvedValue(null);
      await expect(service.verifyEmailToken('abc')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('est idempotent si déjà vérifié (pas de transaction)', async () => {
      db.verificationToken.findFirst.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 10_000),
        user: { emailVerifiedAt: new Date() },
      });

      await expect(service.verifyEmailToken('abc')).resolves.toBe(true);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('lève BadRequest (Token expired) quand le token est expiré', async () => {
      db.verificationToken.findFirst.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        expiresAt: new Date(Date.now() - 10_000),
        user: { emailVerifiedAt: null },
      });
      await expect(service.verifyEmailToken('abc')).rejects.toThrow(
        'Token expired',
      );
    });

    it('token valide : marque vérifié + supprime le token (transaction), renvoie true', async () => {
      db.verificationToken.findFirst.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 10_000),
        user: { emailVerifiedAt: null },
      });

      await expect(service.verifyEmailToken('abc')).resolves.toBe(true);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(db.verificationToken.delete).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
    });

    it('changement en attente : bascule email = pendingEmail, vérifié par construction', async () => {
      db.verificationToken.findFirst.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 10_000),
        // Adresse actuelle déjà vérifiée — le pending doit primer sur
        // l'idempotence « déjà vérifié ».
        user: { emailVerifiedAt: new Date(), pendingEmail: 'new@x.com' },
      });

      await expect(service.verifyEmailToken('abc')).resolves.toBe(true);
      const arg = db.user.update.mock.calls[0][0];
      expect(arg.data.email).toBe('new@x.com');
      expect(arg.data.pendingEmail).toBeNull();
      expect(arg.data.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('course perdue à la bascule (P2002) → BadRequest explicite', async () => {
      db.verificationToken.findFirst.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 10_000),
        user: { emailVerifiedAt: null, pendingEmail: 'new@x.com' },
      });
      db.$transaction.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );

      await expect(service.verifyEmailToken('abc')).rejects.toThrow(
        'no longer available',
      );
    });
  });

  describe('verifyOtpToken (OTP de login)', () => {
    const HASH = bcrypt.hashSync('123456', 4);

    it('Unauthorized si aucun token valide (expiré/inexistant)', async () => {
      db.verificationToken.findFirst.mockResolvedValue(null);
      await expect(
        service.verifyOtpToken('u1', '123456', 'EMAIL' as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('Unauthorized si le code ne correspond pas au hash', async () => {
      db.verificationToken.findFirst.mockResolvedValue({
        userId: 'u1',
        tokenHash: HASH,
      });
      await expect(
        service.verifyOtpToken('u1', '999999', 'EMAIL' as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(db.verificationToken.deleteMany).not.toHaveBeenCalled();
    });

    it('code valide : consomme les tokens et renvoie true', async () => {
      db.verificationToken.findFirst.mockResolvedValue({
        userId: 'u1',
        tokenHash: HASH,
      });
      await expect(
        service.verifyOtpToken('u1', '123456', 'EMAIL' as never),
      ).resolves.toBe(true);
      expect(db.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', type: 'EMAIL' },
      });
    });
  });
});
