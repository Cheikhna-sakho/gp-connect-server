import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, VerificationTokenType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import { MediasService } from 'src/medias/medias.service';
import { UUID } from 'crypto';
import { USER_DEFAULT_INCLUDE } from './entities/user.entity';
import { UpdateUserDto } from './dtos/update-user.dto';
import { EmailService } from 'src/email/email.service';
import { generateEmailToken, getHashFromToken } from './generateEmailToken';
import { PhoneService } from 'src/phone/phone.service';
import { generateOtp } from 'src/common/utils/otp.util';

type Find = { where: Prisma.UserWhereInput };
type FindOne = { where: Prisma.UserWhereInput };
type FindUnique = Prisma.UserWhereUniqueInput;
type Create = { data: Prisma.UserCreateInput };
type Update = {
  data: Prisma.UserUpdateInput;
  where: Prisma.UserWhereUniqueInput;
};

type Delete = { where: Prisma.UserWhereUniqueInput };
const MINUTE_IN_MS = 1000 * 60;
const HOUR_IN_MS = MINUTE_IN_MS * 60;

@Injectable()
export class UsersService {
  private users: DatabaseService['user'];
  private avatar: DatabaseService['userAvatar'];
  private verificationToken: DatabaseService['verificationToken'];
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mediasService: MediasService,
    private readonly mailService: EmailService,
    private readonly phoneService: PhoneService,
  ) {
    this.users = this.databaseService.user;
    this.avatar = this.databaseService.userAvatar;
    this.verificationToken = this.databaseService.verificationToken;
  }
  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }
  async create({ data }: Create) {
    data.password &&= await this.hashPassword(data.password as string);
    try {
      return await this.users.create({ data });
    } catch (e) {
      // Unicité (email/téléphone déjà pris) → 409 propre, pas un 500.
      if ((e as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Email or phone already in use');
      }
      throw e;
    }
  }
  async createAvatar(userId: UUID, image: Express.Multer.File) {
    const existing = await this.avatar.findUnique({
      where: { userId },
      select: { imageId: true },
    });
    const newAvatar = await this.mediasService.createImage(image);
    await this.avatar.upsert({
      where: { userId },
      create: { imageId: newAvatar.id, userId },
      update: { imageId: newAvatar.id },
    });
    if (existing?.imageId) {
      await this.mediasService.delete({ id: existing.imageId });
    }
    return newAvatar;
  }
  async findBy(where: FindUnique) {
    return this.users.findFirst({ where, include: USER_DEFAULT_INCLUDE });
  }
  async findByEmail(email: string) {
    return this.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: USER_DEFAULT_INCLUDE,
    });
  }
  /** Résout un compte par email (insensible à la casse) OU par téléphone. */
  async findByIdentifier(identifier: string) {
    return this.users.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { phone: identifier },
        ],
      },
      include: USER_DEFAULT_INCLUDE,
    });
  }
  async find({ where }: Find) {
    return this.users.findFirst({ where, include: USER_DEFAULT_INCLUDE });
  }
  async findOne({ where }: FindOne) {
    return this.users.findFirst({ where, include: USER_DEFAULT_INCLUDE });
  }

  async updateWhere({ data, where }: Update) {
    data.password &&= await this.hashPassword(data.password as string);
    return this.users.update({ where, data });
  }
  async updateById(id: string, data: UpdateUserDto) {
    data.password &&= await this.hashPassword(data.password as string);

    // Email : double confirmation. L'adresse active (= identifiant de login)
    // ne bascule JAMAIS ici — le nouvel email part en `pendingEmail` et un
    // lien de confirmation est envoyé À LA NOUVELLE adresse ; la bascule a
    // lieu dans verifyEmailToken. Une faute de frappe ne peut donc pas
    // couper l'accès au compte, et le badge « vérifié » reste honnête.
    // Téléphone : bascule immédiate mais vérification invalidée (OTP SMS à
    // refaire) — même logique KYC qu'avant.
    const { email, ...rest } = data;
    const resets: Prisma.UserUpdateInput = {};
    let pendingEmail: string | undefined;
    if (email !== undefined || rest.phone !== undefined) {
      const current = await this.users.findUnique({
        where: { id },
        select: { email: true, phone: true },
      });
      if (email !== undefined && email !== current?.email) {
        const taken = await this.findByEmail(email);
        if (taken && taken.id !== id) {
          throw new ConflictException('Email already in use');
        }
        pendingEmail = email;
      }
      if (rest.phone !== undefined && rest.phone !== current?.phone) {
        resets.phoneVerifiedAt = null;
      }
    }

    let updated;
    try {
      updated = await this.users.update({
        where: { id },
        data: {
          ...rest,
          ...resets,
          ...(pendingEmail ? { pendingEmail } : {}),
        },
      });
    } catch (e) {
      // Unicité (email/téléphone déjà pris) → 409 propre, pas un 500.
      if ((e as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Email or phone already in use');
      }
      throw e;
    }

    // Envoi du lien de confirmation à la nouvelle adresse — jamais bloquant
    // pour le PATCH (l'utilisateur peut re-demander via « renvoyer »).
    if (pendingEmail) {
      void this.sendEmailVerification(id).catch((err) =>
        this.logger.warn(`Email de confirmation non envoyé: ${err}`),
      );
    }

    return updated;
  }
  async delete(where: Delete) {
    // `return` obligatoire : sans lui la suppression partait sans être
    // attendue — succès renvoyé même si la DB refusait.
    return this.users.delete(where);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(userId: string) {
    const [
      missionsAsCarrier,
      missionsAsShipper,
      packagesDelivered,
      totalEarned,
      ratings,
    ] = await Promise.all([
      this.databaseService.mission.count({
        where: { carrierId: userId, status: 'COMPLETED' },
      }),
      this.databaseService.mission.count({
        where: { shipperId: userId, status: 'COMPLETED' },
      }),
      this.databaseService.package.count({
        where: { status: 'DELIVERED', ownerId: userId },
      }),
      this.databaseService.transaction.aggregate({
        where: { mission: { carrierId: userId }, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.databaseService.missionRating.aggregate({
        where: { ratedId: userId },
        _avg: { score: true },
        _count: { score: true },
      }),
    ]);

    return {
      missionsCompleted: missionsAsCarrier + missionsAsShipper,
      missionsAsCarrier,
      missionsAsShipper,
      packagesDelivered,
      totalEarned: Number(totalEarned._sum.amount ?? 0),
      averageRating: ratings._avg.score
        ? Number(ratings._avg.score.toFixed(1))
        : null,
      ratingsCount: ratings._count.score,
    };
  }

  // ─── Preferences ──────────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    return this.databaseService.userPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updatePreferences(
    userId: string,
    data: Partial<{
      notifySms: boolean;
      notifyEmail: boolean;
      notifyPush: boolean;
    }>,
  ) {
    return this.databaseService.userPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  // ─── Saved addresses ──────────────────────────────────────────────────────

  getSavedAddresses(userId: string) {
    return this.databaseService.savedAddress.findMany({
      where: { userId },
      include: { address: { include: { city: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveAddress(userId: string, addressId: string, label?: string) {
    const address = await this.databaseService.address.findUnique({
      where: { id: addressId },
      select: { id: true },
    });
    if (!address) throw new NotFoundException('Address not found');
    const saved = await this.databaseService.savedAddress.upsert({
      where: { userId_addressId: { userId, addressId } },
      create: { userId, addressId, label },
      update: { label },
      include: { address: { include: { city: true } } },
    });
    return saved.address;
  }

  async removeSavedAddress(userId: string, addressId: string) {
    // Idempotent : retirer une adresse non sauvegardée ne doit pas 500
    // (Prisma.delete lève P2025 si la ligne n'existe pas → deleteMany ne lève rien).
    await this.databaseService.savedAddress.deleteMany({
      where: { userId, addressId },
    });
  }
  async getOptPayload(userId: string, type: VerificationTokenType) {
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
