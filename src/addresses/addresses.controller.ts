import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { Public } from 'src/common/decorators/public.decorator';
import { UUID } from 'crypto';
import { CreateAddressDto } from './dtos/create-address.dto';
import { UpdateAddressDto } from './dtos/update-adress-dto';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { AddressQueryFindDto } from './dtos/address-query-find.dto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { AddressEntity } from './entities/addresses.entity';
import { CityEntity } from './entities/city.entity';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  // ─── Public reads ─────────────────────────────────────────────────────────

  @Public()
  @Get()
  @Serialize(AddressEntity)
  getAll(@Query() where: AddressQueryFindDto) {
    return this.addressesService.findAll(where);
  }

  @Public()
  @Get('cities')
  @Serialize(CityEntity)
  getCities(
    @Query('search') search?: string,
    @Query('country') country?: string,
  ) {
    return this.addressesService.findCities(search, country);
  }

  @Public()
  @Get(ID_PARAM)
  @Serialize(AddressEntity)
  getById(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.addressesService.findBy({ id });
  }

  // ─── Admin only ───────────────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  @Serialize(AddressEntity)
  create(@Body() data: CreateAddressDto) {
    return this.addressesService.create(data);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(ID_PARAM)
  @Serialize(AddressEntity)
  update(@Param('id') id: UUID, @Body() data: UpdateAddressDto) {
    return this.addressesService.update({ where: { id }, data });
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(ID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: UUID) {
    return this.addressesService.delete(id);
  }
}
