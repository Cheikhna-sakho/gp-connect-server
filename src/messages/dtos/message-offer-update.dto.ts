import { PartialType } from '@nestjs/swagger';
import { CreateOfferDto } from './message-offer.dto';

export class UpdateOfferDto extends PartialType(CreateOfferDto) {}
