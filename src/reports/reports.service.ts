import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateReportDto } from './dtos/create-report.dto';
import { ResolveReportDto } from './dtos/resolve-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  create(reporterId: string, data: CreateReportDto) {
    if (data.targetType === 'USER' && data.targetId === reporterId) {
      throw new BadRequestException('You cannot report yourself');
    }
    return this.db.report.create({
      data: {
        reporterId,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        description: data.description,
      },
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  findAll(status?: $Enums.ReportStatus) {
    return this.db.report.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: string, adminId: string, data: ResolveReportDto) {
    const report = await this.db.report.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    return this.db.report.update({
      where: { id },
      data: {
        status: data.status,
        resolution: data.resolution,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
  }
}
