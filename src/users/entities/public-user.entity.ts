import { $Enums, Prisma } from '@prisma/client';
import { Expose, Transform } from 'class-transformer';
import { USER_DEFAULT_INCLUDE } from './user.entity';

type Avatar = Prisma.UserAvatarGetPayload<typeof USER_DEFAULT_INCLUDE.avatar>;

// Données brutes de la source dont dépendent les indicateurs agrégés.
type Source = {
  firstName?: string;
  lastName?: string;
  avatar?: Avatar | string | null;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  idCardVerifiedAt?: Date | null;
};

// Vue PUBLIQUE d'un utilisateur (GET /users/:id, non authentifié).
// N'expose aucune donnée de contact (email, téléphone) ni timestamp brut de
// vérification : seulement l'identité d'affichage et des indicateurs agrégés
// (niveau de confiance, complétion). Les booléens de vérification sont dérivés
// de la source via @Transform — les valeurs brutes ne quittent jamais le back.
export class PublicUserEntity {
  @Expose() id: string;

  @Expose() firstName: string;

  @Expose() lastName: string;

  @Expose() role: $Enums.Role;

  @Expose() createdAt: Date;

  @Transform(({ value }: { value?: Avatar | string }) =>
    typeof value === 'string' ? value : value?.image?.url,
  )
  @Expose()
  avatar: Avatar;

  @Expose()
  @Transform(({ obj }: { obj: Source }) =>
    `${obj.firstName ?? ''} ${obj.lastName ?? ''}`.trim(),
  )
  fullName: string;

  @Expose()
  @Transform(({ obj }: { obj: Source }) => {
    const email = !!obj.emailVerifiedAt;
    const phone = !!obj.phoneVerifiedAt;
    const identity = !!obj.idCardVerifiedAt;
    return {
      level: Number(email) + Number(phone) + Number(identity),
      items: {
        email: email ? 'verified' : 'unverified',
        phone: phone ? 'verified' : 'unverified',
        identity: identity ? 'verified' : 'unverified',
      },
    };
  })
  trust: {
    level: number;
    items: { email: string; phone: string; identity: string };
  };

  @Expose()
  @Transform(({ obj }: { obj: Source }) => {
    let score = 0;
    if (obj.emailVerifiedAt) score += 25;
    if (obj.phoneVerifiedAt) score += 25;
    if (obj.idCardVerifiedAt) score += 25;
    if (obj.avatar) score += 25;
    return score;
  })
  profileCompletion: number;
}
