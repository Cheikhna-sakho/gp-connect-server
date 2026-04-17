import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, VerificationTokenType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import { MediasService } from 'src/medias/medias.service';
import { UUID } from 'crypto';
import { USER_DEFAULT_INCLUDE } from './entities/user.entity';
import { UpdateUserDto } from './dtos/update-user-dto';
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
    return this.users.create({ data });
  }
  async createAvatar(userId: UUID, image: Express.Multer.File) {
    const avatar = await this.mediasService.createImage(image);
    await this.avatar.upsert({
      where: { userId },
      create: { imageId: avatar.id, userId },
      update: {
        imageId: avatar.id,
      },
    });
    return avatar;
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
    return this.users.update({ where: { id }, data });
  }
  async delete(where: Delete) {
    this.users.delete(where);
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
    console.log({ expiresAt, tokenHash });
    return { ...user, token };
  }
  async sendEmailVerification(userId: string) {
    const user = await this.users.findUnique({ where: { id: userId } });
    if (user.emailVerifiedAt) return;
    const { hash, token } = generateEmailToken();
    await this.verificationToken.create({
      data: {
        userId,
        type: VerificationTokenType.EMAIL,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + HOUR_IN_MS),
      },
    });
    return this.mailService.sendEmailVerification(user.email, token);
  }

  async verifyEmailToken(token: string) {
    const tokenHash = getHashFromToken(token);
    const now = new Date();
    const record = await this.verificationToken.findFirst({
      where: { tokenHash, type: VerificationTokenType.EMAIL },
      select: {
        userId: true,
        id: true,
        expiresAt: true,
        user: { select: { emailVerifiedAt: true } },
      },
    });

    if (!record) throw new BadRequestException('Invalid token');
    if (record?.user?.emailVerifiedAt) return true;
    if (record.expiresAt < now) throw new BadRequestException('Token expired');
    await this.databaseService.$transaction([
      this.users.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.verificationToken.delete({ where: { id: record.id } }),
    ]);

    return true;
  }

  async verifyOtpToken(
    email: string,
    token: string,
    type: VerificationTokenType,
  ) {
    const now = new Date();
    const record = await this.verificationToken.findFirst({
      where: {
        user: { email: { mode: 'insensitive', equals: email } },
        type,
        usedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        userId: true,
        tokenHash: true,
        user: { select: { phoneVerifiedAt: true, emailVerifiedAt: true } },
      },
    });
    if (!record) throw new UnauthorizedException('Token expired.');
    const verified = await bcrypt.compare(token, record.tokenHash);
    console.log({ verified, now, record });
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
