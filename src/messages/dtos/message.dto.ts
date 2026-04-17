import {
  IsString,
  IsUUID,
  IsEnum,
  IsEmpty,
  ValidateIf,
  ValidateNested,
  IsNotEmpty,
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
