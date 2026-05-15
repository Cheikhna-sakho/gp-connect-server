import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdvertisementsService } from './advertisements.service';
import { UUID } from 'crypto';
import { AddressesService } from 'src/addresses/addresses.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { CreateAdvertisementDto } from './dtos/create-advertisements.dto';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { CreateAdvertisementWithAddressDto } from './dtos/create-advertisements-with-address.dto';
import { UpdateAdvertisementDto } from './dtos/update-advertisement.dto';
import { AdvertisementEntity } from './entities/advertisement.entity';
import { AdvertisementQueryFindDto } from './dtos/advertisements-query-find.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { SerializePage } from 'src/common/decorators/serialize-page.decorator';

@Controller('advertisements')
export class AdvertisementsController {
  constructor(
    readonly advertisementsService: AdvertisementsService,
    readonly addressService: AddressesService,
  ) {}

  @Public()
  @Get()
  @SerializePage(AdvertisementEntity)
  getAll(
    @Query()
    {
      page, limit, maxWeight,
      departureCityName, destinationCityName,
      sortBy, order,
      ...where
    }: AdvertisementQueryFindDto,
  ) {
    const prismaWhere = {
      ...where,
      // status is not in AdvertisementQueryFindDto (whitelist strips it)
      // but we force OPEN to never expose CLOSED/COMPLETED in public browse
      status: 'OPEN' as const,
      maxWeight: maxWeight ? { lte: maxWeight } : undefined,
      ...(departureCityName
        ? { departure: { city: { name: { contains: departureCityName, mode: 'insensitive' as const } } } }
        : {}),
      ...(destinationCityName
        ? { destination: { city: { name: { contains: destinationCityName, mode: 'insensitive' as const } } } }
        : {}),
    };
    const orderBy = sortBy ? { [sortBy]: order ?? 'asc' } : { createdAt: 'desc' as const };
    return this.advertisementsService.findAll(prismaWhere, { page, limit }, orderBy);
  }

  @Public()
  @Get(ID_PARAM)
  @Serialize(AdvertisementEntity)
  getOne(@Param('id') id: UUID) {
    return this.advertisementsService.findBy({ id });
  }

  @Get(`${ID_PARAM}/offers`)
  getOffers(@Param('id') id: UUID) {
    return this.advertisementsService.findOffers(id);
  }

  @Get('mine')
  @SerializePage(AdvertisementEntity)
  getMine(
    @GetUserId() authorId: string,
    @Query()
    {
      page, limit, arrivalDate,
      departureCityName, destinationCityName,
      sortBy, order,
      ...where
    }: AdvertisementQueryFindDto,
  ) {
    const prismaWhere = {
      authorId,
      ...where,
      ...(arrivalDate ? { arrivalDate: { gte: arrivalDate } } : {}),
      ...(departureCityName
        ? { departure: { city: { name: { contains: departureCityName, mode: 'insensitive' as const } } } }
        : {}),
      ...(destinationCityName
        ? { destination: { city: { name: { contains: destinationCityName, mode: 'insensitive' as const } } } }
        : {}),
    };
    const orderBy = sortBy ? { [sortBy]: order ?? 'asc' } : { arrivalDate: 'asc' as const };
    return this.advertisementsService.findAll(prismaWhere, { page, limit }, orderBy, true);
  }

  @UseGuards(RolesGuard)
  @Roles('SHIPPER')
  @Post('delivery')
  @Serialize(AdvertisementEntity)
  async createDelivery(
    @GetUserId() authorId: string,
    @Body() data: CreateAdvertisementDto,
  ) {
    data.authorId = authorId;
    data.type = 'DELIVERY';
    return this.advertisementsService.create(data);
  }

  @UseGuards(RolesGuard)
  @Roles('CARRIER')
  @Post('shipping')
  @Serialize(AdvertisementEntity)
  async createShipping(
    @GetUserId() authorId: string,
    @Body() data: CreateAdvertisementWithAddressDto,
  ) {
    data.authorId = authorId;
    data.type = 'SHIPPING';
    const { departure, destination, ...dto } = data;
    const { id: destinationId } = await this.addressService.createIfNotExist(
      { ...destination },
      { id: true },
    );
    const { id: departureId } = await this.addressService.createIfNotExist(
      { ...departure },
      { id: true },
    );
    return this.advertisementsService.create({ ...dto, destinationId, departureId });
  }

  @Patch(ID_PARAM)
  @Serialize(AdvertisementEntity)
  update(
    @GetUserId() authorId: string,
    @Body() data: UpdateAdvertisementDto,
    @Param('id') id: UUID,
  ) {
    return this.advertisementsService.update({ data, where: { id, authorId } });
  }

  @Delete(ID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@GetUserId() authorId: string, @Param('id') id: UUID) {
    return this.advertisementsService.delete({ where: { id, authorId } });
  }
}
