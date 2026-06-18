import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { $Enums } from '@prisma/client';
import { ReportsService } from './reports.service';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { SetIdParam } from 'src/common/constants/route.util.const';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { ReportEntity } from './entities/report.entity';
import { CreateReportDto } from './dtos/create-report.dto';
import { ResolveReportDto } from './dtos/resolve-report.dto';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Tout utilisateur authentifié peut signaler.
  @Post()
  @Serialize(ReportEntity)
  create(@GetUserId() userId: string, @Body() data: CreateReportDto) {
    return this.reportsService.create(userId, data);
  }

  // ─── Admin : modération ───────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAll(@Query('status') status?: $Enums.ReportStatus) {
    return this.reportsService.findAll(status);
  }

  @Patch(SetIdParam('id'))
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  resolve(
    @GetUserId() adminId: string,
    @Param('id') id: string,
    @Body() data: ResolveReportDto,
  ) {
    return this.reportsService.resolve(id, adminId, data);
  }
}
