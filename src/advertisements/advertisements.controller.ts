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
  async getAll(
    @Query()
    {
      page,
      limit,
      maxWeight,
      price,
      arrivalDate,
      departureCityName,
      destinationCityName,
      lat,
      lng,
      radius,
      sortBy,
      order,
      ...where
    }: AdvertisementQueryFindDto,
  ) {
    // Exclure les annonces expirées (date d'arrivée passée). Si le client
    // fournit aussi un filtre arrivalDate, on garde la borne la plus restrictive.
    const now = new Date();
    const arrivalFloor =
      arrivalDate && new Date(arrivalDate) > now ? arrivalDate : now;

    const prismaWhere: Record<string, any> = {
      ...where,
      status: 'OPEN' as const,
      // "Prix max" → annonces dont le prix est ≤ à la valeur saisie
      ...(price ? { price: { lte: price } } : {}),
      // "Poids min dispo" → annonces dont la capacité est ≥ à la valeur saisie
      ...(maxWeight ? { maxWeight: { gte: maxWeight } } : {}),
      // Annonces dont la date d'arrivée est >= max(maintenant, date saisie)
      arrivalDate: { gte: arrivalFloor },
      ...(departureCityName
        ? {
            departure: {
              city: {
                name: {
                  contains: departureCityName,
                  mode: 'insensitive' as const,
                },
              },
            },
          }
        : {}),
      ...(destinationCityName
        ? {
            destination: {
              city: {
                name: {
                  contains: destinationCityName,
                  mode: 'insensitive' as const,
                },
              },
            },
          }
        : {}),
    };

    // Filtre géospatial PostGIS : restreindre aux annonces dont la ville de départ
    // est dans le rayon défini (défaut 100 km)
    if (lat !== undefined && lng !== undefined) {
      const nearbyIds = await this.advertisementsService.findNearbyIds(
        lat,
        lng,
        radius ?? 100,
      );
      prismaWhere.id = { in: nearbyIds };
    }

    const orderBy = sortBy
      ? { [sortBy]: order ?? 'asc' }
      : { createdAt: 'desc' as const };
    return this.advertisementsService.findAll(
      prismaWhere,
      { page, limit },
      orderBy,
    );
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
      page,
      limit,
      arrivalDate,
      departureCityName,
      destinationCityName,
      sortBy,
      order,
      ...where
    }: AdvertisementQueryFindDto,
  ) {
    const prismaWhere = {
      authorId,
      ...where,
      ...(arrivalDate ? { arrivalDate: { gte: arrivalDate } } : {}),
      ...(departureCityName
        ? {
            departure: {
              city: {
                name: {
                  contains: departureCityName,
                  mode: 'insensitive' as const,
                },
              },
            },
          }
        : {}),
      ...(destinationCityName
        ? {
            destination: {
              city: {
                name: {
                  contains: destinationCityName,
                  mode: 'insensitive' as const,
                },
              },
            },
          }
        : {}),
    };
    const orderBy = sortBy
      ? { [sortBy]: order ?? 'asc' }
      : { arrivalDate: 'asc' as const };
    return this.advertisementsService.findAll(
      prismaWhere,
      { page, limit },
      orderBy,
      true,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('CARRIER')
  @Post('delivery')
  @Serialize(AdvertisementEntity)
  async createDelivery(
    @GetUserId() authorId: string,
    @Body() data: CreateAdvertisementWithAddressDto,
  ) {
    data.authorId = authorId;
    data.type = 'DELIVERY';
    const { departure, destination, ...dto } = data;
    const { id: destinationId } = await this.addressService.createIfNotExist(
      { ...destination },
      { id: true },
    );
    const { id: departureId } = await this.addressService.createIfNotExist(
      { ...departure },
      { id: true },
    );
    return this.advertisementsService.create({
      ...dto,
      destinationId,
      departureId,
    });
  }

  @UseGuards(RolesGuard)
  @Roles('SHIPPER')
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
    return this.advertisementsService.create({
      ...dto,
      destinationId,
      departureId,
    });
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
