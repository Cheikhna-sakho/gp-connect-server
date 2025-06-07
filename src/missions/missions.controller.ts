import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dtos/missions.dto';
import { Roles } from 'src/auth/decorators/role.decorator';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UUID } from 'crypto';
import { MissionPartial } from './dtos/mission-partial.dto';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('/all')
  getAll() {
    return this.missionsService.findAll();
  }
  @Get()
  getOwn(@GetUserId() id: UUID, @Query() where: MissionPartial) {
    return this.missionsService.findAll({
      AND: [
        {
          OR: [{ initiatorId: id }, { acceptorId: id }],
        },
        where,
      ],
    });
  }

  @Post()
  create(@GetUserId() initiatorId: UUID, @Body() data: CreateMissionDto) {
    data.initiatorId = initiatorId;
    return this.missionsService.create(data);
  }
}
