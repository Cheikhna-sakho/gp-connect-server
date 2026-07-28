import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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

@ApiTags('advertisements')
@Controller('advertisements')
export class AdvertisementsController {
  constructor(
    readonly advertisementsService: AdvertisementsService,
    readonly addressService: AddressesService,
  ) {}

  @Public()
  @Get()
  @SerializePage(AdvertisementEntity)
  getAll(@Query() query: AdvertisementQueryFindDto) {
    return this.advertisementsService.searchPublic(query);
  }

  @Public()
  @Get(ID_PARAM)
  @ApiNotFoundResponse({ description: 'Annonce inconnue ou supprimée' })
  @Serialize(AdvertisementEntity)
  async getOne(@Param('id') id: UUID) {
    // Vue publique sans conversations → pas de fuite des offres/enchérisseurs.
    const ad = await this.advertisementsService.findPublic(id);
    // Sans ce garde : 200 + {} pour une annonce supprimée (le front croyait
    // à une annonce vide au lieu d'un vrai « n'existe plus »).
    if (!ad) throw new NotFoundException('Advertisement not found');
    return ad;
  }

  // Les offres reçues sur une annonce ne sont visibles que par son auteur
  // (sinon n'importe qui voyait les enchères/prix de tous les candidats).
  @ApiAuth()
  @ApiForbiddenResponse({ description: "Réservé à l'auteur de l'annonce" })
  @Get(`${ID_PARAM}/offers`)
  async getOffers(@GetUserId() userId: string, @Param('id') id: UUID) {
    const ad = await this.advertisementsService.findBy({ id });
    if (!ad) throw new NotFoundException();
    if (ad.authorId !== userId) throw new ForbiddenException();
    return this.advertisementsService.findOffers(id);
  }

  @ApiAuth()
  @Get('mine')
  @SerializePage(AdvertisementEntity)
  getMine(
    @GetUserId() authorId: string,
    @Query() query: AdvertisementQueryFindDto,
  ) {
    return this.advertisementsService.searchMine(authorId, query);
  }

  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Rôle CARRIER requis' })
  @UseGuards(RolesGuard)
  @Roles('CARRIER')
  @Post('delivery')
  @Serialize(AdvertisementEntity)
  createDelivery(
    @GetUserId() authorId: string,
    @Body() data: CreateAdvertisementWithAddressDto,
  ) {
    return this.createWithAddresses(authorId, 'DELIVERY', data);
  }

  @ApiAuth()
  @ApiForbiddenResponse({ description: 'Rôle SHIPPER requis' })
  @UseGuards(RolesGuard)
  @Roles('SHIPPER')
  @Post('shipping')
  @Serialize(AdvertisementEntity)
  createShipping(
    @GetUserId() authorId: string,
    @Body() data: CreateAdvertisementWithAddressDto,
  ) {
    return this.createWithAddresses(authorId, 'SHIPPING', data);
  }

  // authorId et type sont imposés par le token/la route — jamais par le body.
  private async createWithAddresses(
    authorId: string,
    type: 'DELIVERY' | 'SHIPPING',
    data: CreateAdvertisementWithAddressDto,
  ) {
    data.authorId = authorId;
    data.type = type;
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

  @ApiAuth()
  @ApiForbiddenResponse({ description: "Réservé à l'auteur de l'annonce" })
  @ApiNotFoundResponse({ description: 'Annonce inconnue' })
  @Patch(ID_PARAM)
  @Serialize(AdvertisementEntity)
  update(
    @GetUserId() authorId: string,
    @Body() data: UpdateAdvertisementDto,
    @Param('id') id: UUID,
  ) {
    return this.advertisementsService.update({ data, where: { id, authorId } });
  }

  @ApiAuth()
  @ApiForbiddenResponse({ description: "Réservé à l'auteur de l'annonce" })
  @ApiBadRequestResponse({
    description: 'Annonce avec mission en cours — suppression refusée',
  })
  @Delete(ID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@GetUserId() authorId: string, @Param('id') id: UUID) {
    return this.advertisementsService.delete({ where: { id, authorId } });
  }
}
