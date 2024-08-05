import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { Public } from 'src/common/decorators/public.decorator';
import { Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { addressesFixtures } from './fixtures/addresses.fixture';

@Public()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async getAll() {
    return this.addressesService.findAll();
  }

  @Get(':id')
  async getById(@Param('id') id: UUID) {
    return this.addressesService.findBy({ id });
  }
  @Get('where')
  async getWhere(@Query() query: any) {
    const where = JSON.parse(query.where);
    return this.addressesService.findOne({ where });
  }

  @Post()
  async create(@Body() data: Prisma.AddressCreateInput) {
    return this.addressesService.create(data);
  }
  @Post('fixtures')
  async createFixture() {
    for (const address of addressesFixtures) {
      await this.addressesService.create(address);
    }
    return this.getAll();
  }

  @Patch(':id')
  async update(@Param('id') id: UUID, @Body() data: Prisma.AddressUpdateInput) {
    return this.addressesService.update({ where: { id }, data });
  }

  @Delete(':id')
  async delete(@Param('id') id: UUID) {
    return this.addressesService.delete(id);
  }
}
