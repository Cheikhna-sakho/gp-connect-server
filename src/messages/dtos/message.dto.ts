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
import { Type } from 'class-transformer';

const IsForType = (type: $Enums.MessageType) =>
  ValidateIf((o) => o.type === type);

export class CreateMessageDto
  extends CreateOfferDto
  implements Omit<Prisma.MessageUncheckedCreateInput, 'offer'>
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
}
