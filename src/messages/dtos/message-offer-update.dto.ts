import { PartialType } from '@nestjs/mapped-types';
import { CreateOfferDto } from './message-offer.dto';

export class UpdateOfferDto extends PartialType(CreateOfferDto) {}
