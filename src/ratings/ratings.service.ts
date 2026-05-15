import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateRatingDto } from './dtos/create-rating.dto';

@Injectable()
export class RatingsService {
  private ratings: DatabaseService['missionRating'];

  constructor(private readonly databaseService: DatabaseService) {
    this.ratings = this.databaseService.missionRating;
  }

  async create(missionId: string, raterId: string, data: CreateRatingDto) {
    const mission = await this.databaseService.mission.findUnique({
      where: { id: missionId },
      select: { status: true, shipperId: true, carrierId: true },
    });

    if (!mission) throw new NotFoundException('Mission not found');
    if (mission.status !== 'COMPLETED') {
      throw new BadRequestException('Can only rate a completed mission');
    }
    if (raterId !== mission.shipperId && raterId !== mission.carrierId) {
      throw new ForbiddenException();
    }

    // Rate the other party
    const ratedId = raterId === mission.shipperId ? mission.carrierId : mission.shipperId;
    if (!ratedId) throw new BadRequestException('No carrier assigned to this mission');

    try {
      return await this.ratings.create({
        data: { missionId, raterId, ratedId, ...data },
      });
    } catch (e) {
      if (e?.code === 'P2002') {
        throw new ConflictException('You have already rated this mission');
      }
      throw e;
    }
  }

  findByMission(missionId: string) {
    return this.ratings.findMany({
      where: { missionId },
      include: {
        rater: { select: { id: true, firstName: true, lastName: true } },
        rated: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findByUser(userId: string) {
    const [received, average] = await Promise.all([
      this.ratings.findMany({
        where: { ratedId: userId },
        include: {
          rater: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.ratings.aggregate({
        where: { ratedId: userId },
        _avg: { score: true },
        _count: { score: true },
      }),
    ]);
    return {
      ratings: received,
      averageScore: average._avg.score,
      total: average._count.score,
    };
  }
}
