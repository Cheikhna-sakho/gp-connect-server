import { PartialType } from '@nestjs/mapped-types';
import { AdvertisementDto } from './advertisement.dto';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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

  // Sorting
  @IsOptional()
  @IsIn(['price', 'arrivalDate', 'createdAt', 'weight', 'maxWeight'])
  sortBy?: 'price' | 'arrivalDate' | 'createdAt' | 'weight' | 'maxWeight';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
