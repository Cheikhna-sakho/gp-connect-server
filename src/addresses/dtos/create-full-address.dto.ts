import { OmitType } from '@nestjs/mapped-types';
import { CreateAddressDto } from './create-address.dto';
import { CreateCountryDto } from './create-country.dto';
import { IsObject, IsString, ValidateNested } from 'class-validator';

export class CreateFullAddressDto extends OmitType(CreateAddressDto, [
  'cityId',
]) {
  @IsString()
  city: string;

  @IsObject()
  @ValidateNested()
  country: CreateCountryDto;

  @IsString()
  state: string;
}
