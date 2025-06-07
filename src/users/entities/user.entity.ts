import { $Enums, Prisma, User } from '@prisma/client';
import { Exclude, Expose, Transform } from 'class-transformer';

export const USER_DEFAULT_INCLUDE = {
  avatar: { select: { image: true } },
} as const;

type UserI = Prisma.UserGetPayload<{
  include: typeof USER_DEFAULT_INCLUDE;
}>;
type Avatar = Prisma.UserAvatarGetPayload<typeof USER_DEFAULT_INCLUDE.avatar>;
export class UserEntity implements UserI {
  @Expose() id: string;

  @Expose() firstName: string;

  @Expose() lastName: string;

  @Transform(({ value }: { value?: Avatar }) => {
    if (typeof value === 'string') {
      return value;
    }
    return value?.image.url;
  })
  @Expose()
  avatar: Avatar;

  @Expose() email: string;

  @Expose() role: $Enums.Role;

  @Expose() updatedAt: Date;

  @Expose() createdAt: Date;

  @Exclude() password: string;

  @Expose() get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
