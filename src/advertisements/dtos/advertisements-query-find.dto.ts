import { PartialType } from '@nestjs/mapped-types';
import { AdvertisementDto } from './advertisement.dto';
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdvertisementQueryFindDto extends PartialType(AdvertisementDto) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // Filter by city name (contains, case-insensitive)
  @IsOptional()
  @IsString()
  departureCityName?: string;

  @IsOptional()
  @IsString()
  destinationCityName?: string;

  // Geospatial filter — departure location within radius
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radius?: number; // kilometres, default 100

  // Sorting
  @IsOptional()
  @IsIn(['price', 'arrivalDate', 'createdAt', 'maxWeight'])
  sortBy?: 'price' | 'arrivalDate' | 'createdAt' | 'maxWeight';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
