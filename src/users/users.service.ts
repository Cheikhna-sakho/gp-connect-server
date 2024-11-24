import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import * as bcrypt from 'bcrypt';

type Find = { where: Prisma.UserWhereInput };
type FindOne = { where: Prisma.UserWhereInput };
type FindUnique = Prisma.UserWhereUniqueInput;
type Create = { data: Prisma.UserCreateInput };
type Update = {
  data: Prisma.UserUpdateInput;
  where: Prisma.UserWhereUniqueInput;
};
type UpdateBy = Prisma.UserUpdateInput;

type Delete = { where: Prisma.UserWhereUniqueInput };

@Injectable()
export class UsersService {
  private users: DatabaseService['user'];

  constructor(private readonly databaseService: DatabaseService) {
    this.users = this.databaseService.user;
  }
  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }
  async findBy(where: FindUnique) {
    return this.users.findFirst({ where });
  }
  async find({ where }: Find) {
    return this.users.findFirst({ where });
  }
  async findOne({ where }: FindOne) {
    return this.users.findFirst({ where });
  }
  async findAll() {
    return this.users.findMany();
  }
  async create({ data }: Create) {
    data.password = await this.hashPassword(data.password);
    return this.users.create({ data });
  }
  async updateWhere({ data, where }: Update) {
    data.password &&= await this.hashPassword(data.password as string);
    return this.users.update({ where, data });
  }
  async updateById(id: string, data: UpdateBy) {
    data.password &&= await this.hashPassword(data.password as string);
    return this.users.update({ where: { id }, data });
  }
  async delete(where: Delete) {
    this.users.delete(where);
  }
}
