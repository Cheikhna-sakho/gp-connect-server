import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { VerificationTokenType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';
import { PhoneService } from 'src/phone/phone.service';
import { generateEmailToken, getHashFromToken } from './generateEmailToken';
import { generateOtp } from 'src/common/utils/otp.util';

const MINUTE_IN_MS = 1000 * 60;
const HOUR_IN_MS = MINUTE_IN_MS * 60;

/**
 * Vérification des canaux de contact (email + téléphone) : génération et
 * consommation des tokens/OTP, envoi des liens et codes. Séparé du CRUD
 * utilisateur (UsersService) — une seule raison de changer : la politique
 * de vérification.
 */
@Injectable()
export class UserVerificationService {
  private users: DatabaseService['user'];
  private verificationToken: DatabaseService['verificationToken'];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailService: EmailService,
    private readonly phoneService: PhoneService,
  ) {
    this.users = this.databaseService.user;
    this.verificationToken = this.databaseService.verificationToken;
  }

  private async getOptPayload(userId: string, type: VerificationTokenType) {
    const user = await this.users.findUnique({
      where: { id: userId },
      select: { tokens: true, email: true, phone: true },
    });
    const { hash: tokenHash, plain: token, expiresAt } = await generateOtp();
    await this.verificationToken.deleteMany({
      where: { userId: userId, type },
    });
    await this.verificationToken.create({
      data: { userId, type, tokenHash, expiresAt },
    });
    return { ...user, token };
  }

  async sendEmailVerification(userId: string) {
    const user = await this.users.findUnique({ where: { id: userId } });
    // Un changement en attente prime : le lien part à la NOUVELLE adresse
    // (c'est elle qu'il faut prouver), même si l'actuelle est déjà vérifiée.
    if (!user) return;
    if (!user.pendingEmail && user.emailVerifiedAt) return;
    const { hash, token } = generateEmailToken();
    await this.verificationToken.create({
      data: {
        userId,
        type: VerificationTokenType.EMAIL,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + HOUR_IN_MS),
      },
    });
    return this.mailService.sendEmailVerification(
      user.pendingEmail ?? user.email,
      token,
    );
  }

  async verifyEmailToken(token: string) {
    if (!token) throw new BadRequestException('Invalid token');
    const tokenHash = getHashFromToken(token);
    const now = new Date();
    const record = await this.verificationToken.findFirst({
      where: { tokenHash, type: VerificationTokenType.EMAIL },
      select: {
        userId: true,
        id: true,
        expiresAt: true,
        user: { select: { emailVerifiedAt: true, pendingEmail: true } },
      },
    });

    if (!record) throw new BadRequestException('Invalid token');
    const pending = record.user?.pendingEmail;
    // Lien rejoué sans changement en attente : idempotent.
    if (!pending && record.user?.emailVerifiedAt) return true;
    if (record.expiresAt < now) throw new BadRequestException('Token expired');
    try {
      await this.databaseService.$transaction([
        this.users.update({
          where: { id: record.userId },
          // Changement d'email en attente : la bascule a lieu ICI, une fois
          // le contrôle de la nouvelle adresse prouvé par le clic — et elle
          // est vérifiée par construction.
          data: pending
            ? {
                email: pending,
                pendingEmail: null,
                emailVerifiedAt: new Date(),
              }
            : { emailVerifiedAt: new Date() },
        }),
        this.verificationToken.delete({ where: { id: record.id } }),
      ]);
    } catch (e) {
      // Course : l'adresse a été prise par un autre compte entre la demande
      // et le clic (pendingEmail n'est pas unique — c'est ici que ça se joue).
      if ((e as { code?: string })?.code === 'P2002') {
        throw new BadRequestException(
          'This email address is no longer available',
        );
      }
      throw e;
    }

    return true;
  }

  async verifyOtpToken(
    userId: string,
    token: string,
    type: VerificationTokenType,
  ) {
    const now = new Date();
    const record = await this.verificationToken.findFirst({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        userId: true,
        tokenHash: true,
      },
    });
    if (!record) throw new UnauthorizedException('Token expired.');
    const verified = await bcrypt.compare(token, record.tokenHash);
    if (!verified) throw new UnauthorizedException('Token invalid');
    await this.verificationToken.deleteMany({
      where: { userId: record.userId, type },
    });
    return verified;
  }

  async sendPhoneVerification(userId: string) {
    const { phone, token } = await this.getOptPayload(
      userId,
      VerificationTokenType.PHONE,
    );
    // Compte inscrit sans téléphone : un OTP « par SMS » est impossible →
    // 400 explicite plutôt qu'un 500 Twilio (« params['to'] missing »).
    if (!phone) {
      throw new BadRequestException('No phone number on this account');
    }
    return this.phoneService.sendPhoneVerification(phone, token);
  }

  async sendEmailOpt(userId: string) {
    const { email, token } = await this.getOptPayload(
      userId,
      VerificationTokenType.EMAIL,
    );
    return this.mailService.sendEmailOpt(email, token);
  }
}
