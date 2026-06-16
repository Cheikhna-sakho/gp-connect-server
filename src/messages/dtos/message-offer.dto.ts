import { $Enums, Prisma } from '@prisma/client';
import {
  IsOptional,
  IsEmpty,
  IsNumber,
  Min,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto implements Prisma.MessageOfferUncheckedCreateInput {
  @IsEmpty()
  id: string;

  // Prix proposé → alimente negotiatedPrice + transaction.amount à l'acceptation
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  weight: number;

  // `status` et `missionId` ne sont JAMAIS settables par le client : une offre
  // naît PENDING (défaut schéma), et le passage ACCEPTED/REJECTED + le lien
  // mission sont pilotés côté serveur (OffersService) avec toute la logique
  // métier (gate KYC, création mission/transaction, rejet des autres offres).
  @IsEmpty()
  missionId: string;

  @IsEmpty()
  messageId: string;

  @IsEmpty()
  status?: $Enums.MessageOfferStatus;
}
