import { IsObject, ValidateNested } from 'class-validator';
import { CreateAdvertisementDto } from './create-advertisements.dto';
import { OmitType } from '@nestjs/mapped-types';
import { CreateFullAddressDto } from 'src/addresses/dtos/create-full-address.dto';

export class CreateAdvertisementWithAddressDto extends OmitType(
  CreateAdvertisementDto,
  ['departureId', 'departureId'],
) {
  @IsObject()
  @ValidateNested()
  departure: CreateFullAddressDto;
  @IsObject()
  @ValidateNested()
  destination: CreateFullAddressDto;
}
