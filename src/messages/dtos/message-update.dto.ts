import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateOfferDto } from './message-offer-update.dto';

// Édition d'un message : on n'autorise QUE le contenu texte et les termes de
// l'offre. Surtout pas `conversationId`/`type` (déplacer son message dans une
// autre conversation = injection) ni `authorId`.
export class MessageUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateOfferDto)
  offer?: UpdateOfferDto;
}
