import {
  IsString,
  IsUUID,
  IsEnum,
  IsEmpty,
  ValidateIf,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Prisma, $Enums } from '@prisma/client';
import { CreateOfferDto } from './message-offer.dto';
import { CreateAppointmentDto } from './message-appointment.dto';
import { Type } from 'class-transformer';

const IsForType = (type: $Enums.MessageType) =>
  ValidateIf((o) => o.type === type);

// N'HÉRITE PAS de CreateOfferDto : sinon price/weight/id de l'offre seraient
// whitelistés à la RACINE du message et atterriraient dans message.create
// (→ « Unknown argument price » = 500). Les termes de l'offre passent
// exclusivement par le champ imbriqué `offer`.
export class CreateMessageDto
  implements Omit<Prisma.MessageUncheckedCreateInput, 'offer' | 'appointment'>
{
  @IsForType('TEXT')
  @IsString()
  @IsNotEmpty()
  // Aligné sur le front (MAX_LENGTH, DiscussionForm.tsx) : le serveur
  // garantit ce que l'UI promet — toute évolution doit changer les deux.
  @MaxLength(1000)
  content: string;

  @IsUUID()
  conversationId: string;

  @IsEnum($Enums.MessageType)
  type?: $Enums.MessageType;

  @IsEmpty()
  authorId: string;

  @IsForType('OFFER')
  @ValidateNested()
  @Type(() => CreateOfferDto)
  offer: CreateOfferDto;

  @IsForType('APPOINTMENT')
  @ValidateNested()
  @Type(() => CreateAppointmentDto)
  appointment: CreateAppointmentDto;
}
