import { IntersectionType, OmitType } from '@nestjs/mapped-types';
import { CreateAddressDto } from './create-address.dto';
import { IsString } from 'class-validator';
import { CreateCityDto } from './create-city-dto';

export class CreateFullAddressDto extends IntersectionType(
  OmitType(CreateAddressDto, ['cityId']),
  OmitType(CreateCityDto, ['name']),
) {
  @IsString()
  city: string;
}
