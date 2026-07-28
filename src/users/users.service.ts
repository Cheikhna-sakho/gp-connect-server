import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import { MediasService } from 'src/medias/medias.service';
import { UUID } from 'crypto';
import { USER_DEFAULT_INCLUDE } from './entities/user.entity';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UserVerificationService } from './user-verification.service';
import { isUniqueViolation } from 'src/common/utils/prisma-errors.util';

type Find = { where: Prisma.UserWhereInput };
type FindOne = { where: Prisma.UserWhereInput };
type FindUnique = Prisma.UserWhereUniqueInput;
type Create = { data: Prisma.UserCreateInput };
type Update = {
  data: Prisma.UserUpdateInput;
  where: Prisma.UserWhereUniqueInput;
};

type Delete = { where: Prisma.UserWhereUniqueInput };

@Injectable()
export class UsersService {
  private users: DatabaseService['user'];
  private avatar: DatabaseService['userAvatar'];
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mediasService: MediasService,
    private readonly verification: UserVerificationService,
  ) {
    this.users = this.databaseService.user;
    this.avatar = this.databaseService.userAvatar;
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
      if (isUniqueViolation(e)) {
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

    const { email, ...rest } = data;
    const { pendingEmail, resets } = await this.prepareContactChanges(
      id,
      email,
      rest.phone,
    );

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
      if (isUniqueViolation(e)) {
        throw new ConflictException('Email or phone already in use');
      }
      throw e;
    }

    // Envoi du lien de confirmation à la nouvelle adresse — jamais bloquant
    // pour le PATCH (l'utilisateur peut re-demander via « renvoyer »).
    if (pendingEmail) {
      void this.verification
        .sendEmailVerification(id)
        .catch((err) =>
          this.logger.warn(`Email de confirmation non envoyé: ${err}`),
        );
    }

    return updated;
  }

  /**
   * Email : double confirmation. L'adresse active (= identifiant de login)
   * ne bascule JAMAIS ici — le nouvel email part en `pendingEmail` et un
   * lien de confirmation est envoyé À LA NOUVELLE adresse ; la bascule a
   * lieu dans verifyEmailToken. Une faute de frappe ne peut donc pas
   * couper l'accès au compte, et le badge « vérifié » reste honnête.
   * Téléphone : bascule immédiate mais vérification invalidée (OTP SMS à
   * refaire) — même logique KYC qu'avant.
   */
  private async prepareContactChanges(
    id: string,
    email: string | undefined,
    phone: string | undefined,
  ) {
    const resets: Prisma.UserUpdateInput = {};
    let pendingEmail: string | undefined;
    if (email !== undefined || phone !== undefined) {
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
      if (phone !== undefined && phone !== current?.phone) {
        resets.phoneVerifiedAt = null;
      }
    }
    return { pendingEmail, resets };
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
}
