import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdvertisementsService } from './advertisements.service';
import { DatabaseService } from 'src/database/database.service';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';
import { UUID } from 'crypto';
import { AuthRequest } from 'src/common/types/request.type';
import { CreateAdvertisementDto } from './dtos/advertisements.dto';
import { AddressesService } from 'src/addresses/addresses.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('advertisements')
export class AdvertisementsController {
  constructor(
    readonly advertisementsService: AdvertisementsService,
    readonly addressService: AddressesService,
    readonly database: DatabaseService,
  ) {}
  @Public()
  @Get()
  getAll() {
    return this.advertisementsService.findAll();
  }
  @Public()
  @Get(`:id(${ROUTE_UUID_REGEX})`)
  getOne(@Param('id') id: UUID) {
    return this.advertisementsService.findBy({ id });
  }
  @Public()
  @Get('search')
  getWhere(@Query() query: any) {
    return this.advertisementsService.find({ where: query });
  }
  @Get('mine')
  getMine(@Request() req: AuthRequest) {
    const { id: authorId } = req.user;
    return this.advertisementsService.find({ where: { authorId } });
  }
  @UseGuards(RolesGuard)
  @Post('request')
  async createRequest(
    @Request() req: AuthRequest,
    @Body() data: CreateAdvertisementDto,
  ) {
    const { id: authorId } = req.user;
    data.authorId = authorId;
    data.type = 'DeliveryRequest';
    return this.advertisementsService.create(data);
  }
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GP')
  create(@Request() req: AuthRequest, @Body() data: CreateAdvertisementDto) {
    const { id: authorId } = req.user;
    data.authorId = authorId;

    return this.advertisementsService.create(data);
  }
  @Patch(`:id(${ROUTE_UUID_REGEX})`)
  update(
    @Request() req: AuthRequest,
    @Body() data: any,
    @Param('id') id: UUID,
  ) {
    const { id: authorId } = req.user;
    return this.advertisementsService.update({ data, where: { id, authorId } });
  }
  @Delete(`:id(${ROUTE_UUID_REGEX})`)
  delete(@Request() req: AuthRequest, @Param('id') id: UUID) {
    const { id: authorId } = req.user;
    return this.advertisementsService.delete({ where: { id, authorId } });
  }
}
// Addrese
