import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdvertisementsService } from './advertisements.service';
import { DatabaseService } from 'src/database/database.service';
import { UUID } from 'crypto';
import { AddressesService } from 'src/addresses/addresses.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { CreateAdvertisementDto } from './dtos/create-advertisements.dto';
// import { Roles } from 'src/auth/decorators/role.decorator';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { CreateAdvertisementWithAddressDto } from './dtos/create-advertisements-with-address.dto';
import { AdvertisementEntity } from './entities/advertisement.entity';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { AdvertisementQueryFindDto } from './dtos/advertisements-query-find.dto';

@Controller('advertisements')
export class AdvertisementsController {
  constructor(
    readonly advertisementsService: AdvertisementsService,
    readonly addressService: AddressesService,
    readonly database: DatabaseService,
  ) {}
  @Public()
  @Get()
  @Serialize(AdvertisementEntity)
  async getAll(@Query() where: AdvertisementQueryFindDto) {
    return this.advertisementsService.findAll({
      ...where,
      maxWeight: where.maxWeight ? { lte: where.maxWeight } : undefined,
    });
  }
  @Public()
  @Get(ID_PARAM)
  @Serialize(AdvertisementEntity)
  getOne(@Param('id') id: UUID) {
    return this.advertisementsService.findBy({ id });
  }

  @Get('mine')
  @Serialize(AdvertisementEntity)
  async getMine(
    @GetUserId() authorId: string,
    @Query() where: AdvertisementQueryFindDto,
  ) {
    return this.advertisementsService.findAll({ authorId, ...where });
  }
  @UseGuards(RolesGuard)
  @Post('request')
  async createRequest(
    @GetUserId() authorId: string,
    @Body() data: CreateAdvertisementDto,
  ) {
    data.authorId = authorId;
    data.type = 'DeliveryRequest';

    return this.advertisementsService.create(data);
  }
  @Post()
  // @UseGuards(RolesGuard)
  // @Roles('ADMIN', 'GP')
  async create(
    @GetUserId() authorId: string,
    @Body() data: CreateAdvertisementWithAddressDto,
  ) {
    data.authorId = authorId;
    const { departure, destination, ...dto } = data;
    const { id: destinationId } = await this.addressService.createIfNotExist(
      { ...destination },
      { id: true },
    );
    const { id: departureId } = await this.addressService.createIfNotExist(
      { ...departure },
      { id: true },
    );
    // console.log({ departure, destination });
    return this.advertisementsService.create({
      ...dto,
      destinationId,
      departureId,
    });
  }
  @Patch(ID_PARAM)
  update(
    @GetUserId() authorId: string,
    @Body() data: any,
    @Param('id') id: UUID,
  ) {
    return this.advertisementsService.update({ data, where: { id, authorId } });
  }
  @Delete(ID_PARAM)
  delete(@GetUserId() authorId: string, @Param('id') id: UUID) {
    return this.advertisementsService.delete({ where: { id, authorId } });
  }
}
// Addrese
