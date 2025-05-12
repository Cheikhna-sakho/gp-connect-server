import { PartialType } from '@nestjs/mapped-types';
import { AdvertisementDto } from './advertisement.dto';
import { IsEmpty } from 'class-validator';

export class UpdateAdvertisementDto extends PartialType(AdvertisementDto) {
  @IsEmpty()
  authorId: string;
}
