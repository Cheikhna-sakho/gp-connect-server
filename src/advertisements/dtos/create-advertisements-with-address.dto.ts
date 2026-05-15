import { IsObject, ValidateNested } from 'class-validator';
import { CreateAdvertisementDto } from './create-advertisements.dto';
import { OmitType } from '@nestjs/mapped-types';
import { CreateFullAddressDto } from 'src/addresses/dtos/create-full-address.dto';
import { Type } from 'class-transformer';

export class CreateAdvertisementWithAddressDto extends OmitType(
  CreateAdvertisementDto,
  ['departureId', 'destinationId'], // fixed: was ['departureId', 'departureId']
) {
  @IsObject()
  @ValidateNested()
  @Type(() => CreateFullAddressDto)
  departure: CreateFullAddressDto;

  @IsObject()
  @ValidateNested()
  @Type(() => CreateFullAddressDto)
  destination: CreateFullAddressDto;
}
