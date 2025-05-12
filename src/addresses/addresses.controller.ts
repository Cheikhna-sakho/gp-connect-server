import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { Public } from 'src/common/decorators/public.decorator';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { CreateAddressDto } from './dtos/create-address.dto';
import { ID_PARAM } from 'src/common/constants/route.util.const';
import { AddressQueryFindDto } from './dtos/address-query-find.dto';

@Public()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async getAll(@Query() where: AddressQueryFindDto) {
    return this.addressesService.findAll(where);
  }

  @Get(ID_PARAM)
  async getById(@Param('id', ParseUUIDPipe) id: UUID) {
    return this.addressesService.findBy({ id });
  }

  @Post()
  async create(@Body() data: CreateAddressDto) {
    return this.addressesService.create(data);
  }

  @Patch(ID_PARAM)
  async update(@Param('id') id: UUID, @Body() data: Prisma.AddressUpdateInput) {
    return this.addressesService.update({ where: { id }, data });
  }

  @Delete(ID_PARAM)
  async delete(@Param('id') id: UUID) {
    return this.addressesService.delete(id);
  }
}
