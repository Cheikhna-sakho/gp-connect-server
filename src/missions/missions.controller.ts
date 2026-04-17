import {
  Body,
  Controller,
  Delete,
  Get,
  // NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dtos/create-mission.dto';
import { Roles } from 'src/auth/decorators/role.decorator';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UUID } from 'crypto';
import { MissionQuery } from './dtos/mission-query.dto';
import { ProofService } from 'src/proof/proof.service';
import { OffersService } from 'src/offers/offers.service';
import { MissionPackagesDto } from './dtos/mission-packages.dto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { MissionPartial } from './dtos/mission-partial.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { MissionEntity } from './entities/mission.entity';

@Controller('missions')
export class MissionsController {
  constructor(
    private readonly missionsService: MissionsService,
    private readonly proofsService: ProofService,
    private readonly offersService: OffersService,
  ) {}
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('/all')
  getAll() {
    return this.missionsService.findAll();
  }
  @Get()
  @Serialize(MissionEntity)
  getOwn(@GetUserId() id: UUID, @Query() where: MissionQuery) {
    return this.missionsService.findByUser(id, where);
  }

  @Post()
  create(@GetUserId() shipperId: UUID, @Body() data: CreateMissionDto) {
    return this.missionsService.create({ ...data, shipperId });
  }

  @Post(`${ID_PARAM}/packages`)
  addPackages(
    @Param('id') missionId: string,
    @Body() { packageIds }: MissionPackagesDto,
  ) {
    return this.missionsService.addPackages(missionId, packageIds);
  }

  @Post(':id/verify/pickup')
  verifyPickUp(
    @GetUserId() verifiedById: UUID,
    @Param('id') missionId: string,
    @Body() { code }: { code: string },
  ) {
    return this.proofsService.verify({
      missionId,
      code,
      type: 'PICKUP',
      verifiedById,
    });
  }

  @Post(':id/verify/delivery')
  verifyDelivery(
    @GetUserId() verifiedById: UUID,
    @Param('id') missionId: string,
    @Body() { code }: { code: string },
  ) {
    return this.proofsService.verify({
      missionId,
      code,
      type: 'DELIVERY',
      verifiedById,
    });
  }

  @Serialize(MissionEntity)
  @Patch(ID_PARAM)
  async update(@Param('id') id: UUID, @Body() data: MissionPartial) {
    return this.missionsService.update(id, data);
  }

  @Delete(`${ID_PARAM}/packages/${SetIdParam('packageId')}`)
  async deletePackage(
    @Param('id') missionId: string,
    @Param('packageId') packageId: string,
  ) {
    return await this.missionsService.removePackage(missionId, packageId);
  }
  // @Post(':id/accept/offer')
  // async accept(
  //   @Param('id') id: UUID,
  //   @Body() { offerId }: { offerId: string },
  // ) {
  //   const mission = await this.missionsService.findOne(id);
  //   if (!mission) throw new NotFoundException('');
  //   return this.offersService.accept(offerId, {
  //     missionId: mission.id,
  //     ...mission,
  //   });
  // }
}
