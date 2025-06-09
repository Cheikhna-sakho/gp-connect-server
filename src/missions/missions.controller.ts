import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dtos/create-mission.dto';
import { Roles } from 'src/auth/decorators/role.decorator';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UUID } from 'crypto';
import { MissionQuery } from './dtos/mission-query.dto';

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
  getOwn(@GetUserId() id: UUID, @Query() where: MissionQuery) {
    return this.missionsService.findByUser(id, where);
  }

  @Post()
  create(@GetUserId() initiatorId: UUID, @Body() data: CreateMissionDto) {
    data.initiatorId = initiatorId;
    return this.missionsService.create(data);
  }
}
