import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsEmpty,
  ValidateIf,
  ValidateNested,
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
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  conversationId: string;

  @IsEnum($Enums.MessageType)
  type?: $Enums.MessageType;

  @IsUUID()
  advertisementId: string;

  @IsEmpty()
  authorId: string;

  @IsForType('OFFER')
  @ValidateNested()
  @Type(() => CreateOfferDto)
  offer: CreateOfferDto;
  // offer?: Prisma.MessageOfferUncheckedCreateInput;
}
