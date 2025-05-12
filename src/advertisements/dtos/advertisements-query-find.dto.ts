import { PartialType } from '@nestjs/mapped-types';
import { AdvertisementDto } from './advertisement.dto';

export class AdvertisementQueryFindDto extends PartialType(AdvertisementDto) {}
