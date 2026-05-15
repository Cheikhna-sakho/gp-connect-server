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

  @Expose() phone: string;

  @Expose() emailVerifiedAt: Date;

  @Expose() phoneVerifiedAt: Date;

  @Expose() idCardVerifiedAt: Date;

  @Expose()
  get profileCompletion(): number {
    let score = 0;
    if (this.emailVerifiedAt) score += 25;
    if (this.phoneVerifiedAt) score += 25;
    if (this.idCardVerifiedAt) score += 25;
    if (this.avatar) score += 25;
    return score;
  }

  @Expose()
  get trust() {
    const email = !!this.emailVerifiedAt;
    const phone = !!this.phoneVerifiedAt;
    const identity = !!this.idCardVerifiedAt;

    const level = [email, phone, identity].reduce(
      (count, verified) => count + Number(verified),
      0,
    );

    return {
      level,
      items: {
        email: email ? 'verified' : 'unverified',
        phone: phone ? 'verified' : 'unverified',
        identity: identity ? 'verified' : 'unverified',
      },
    };
  }
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
