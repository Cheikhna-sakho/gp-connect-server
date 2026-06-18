import { $Enums, Report } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

// Confirmation renvoyée à l'auteur d'un signalement (vue minimale, pas de PII).
export class ReportEntity implements Partial<Report> {
  @Expose() id: string;
  @Expose() targetType: $Enums.ReportTargetType;
  @Expose() targetId: string;
  @Expose() reason: $Enums.ReportReason;
  @Expose() status: $Enums.ReportStatus;

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  constructor(partial: Partial<ReportEntity>) {
    Object.assign(this, partial);
  }
}
