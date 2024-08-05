import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MissionsService } from './missions.service';
import { AuthRequest } from 'src/common/types/request.type';
import { CreateMissionDto } from './dtos/missions.dto';
import { Roles } from 'src/auth/decorators/role.decorator';
import { RolesGuard } from 'src/auth/guards/role.guard';

@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'GP')
  @Get()
  getAll() {
    return this.missionsService.findAll();
  }
  @Get('mine')
  getUserMissions(@Request() req: AuthRequest) {
    const { id } = req.user;
    return this.missionsService.findUserMissions(id);
  }
  @Post()
  create(@Request() req: AuthRequest, @Body() data: CreateMissionDto) {
    const { id: initiatorId } = req.user;
    const { advertisementId, packageId } = data;
    return this.missionsService.create({
      advertisement: { connect: { id: advertisementId } },
      package: { connect: { id: packageId } },
      initiator: { connect: { id: initiatorId } },
    });
  }
}
