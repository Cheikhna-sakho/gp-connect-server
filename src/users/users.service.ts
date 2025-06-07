import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dtos/user.dto';
import { MediasService } from 'src/medias/medias.service';
import { UUID } from 'crypto';
import { USER_DEFAULT_INCLUDE } from './entities/user.entity';

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

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mediasService: MediasService,
  ) {
    this.users = this.databaseService.user;
    this.avatar = this.databaseService.userAvatar;
  }
  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }
  async create({ data }: Create) {
    data.password = await this.hashPassword(data.password);
    return this.users.create({ data });
  }
  async createAvatar(userId: UUID, image: Express.Multer.File) {
    const avatar = await this.mediasService.createImage(image);
    const avatarExist = await this.avatar.findUnique({ where: { userId } });
    if (avatarExist) {
      await this.avatar.update({
        where: { userId },
        data: { imageId: avatar.id },
      });
    } else await this.avatar.create({ data: { imageId: avatar.id, userId } });
    return avatar;
  }
  async findBy(where: FindUnique) {
    return this.users.findUnique({ where, include: USER_DEFAULT_INCLUDE });
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
}
