import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UUID } from 'crypto';
import { CreateRatingDto } from './dtos/create-rating.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { RatingEntity } from './entities/rating.entity';
import { SetIdParam } from 'src/common/constants/route.util.const';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post(`mission/${SetIdParam('missionId')}`)
  @Serialize(RatingEntity)
  create(
    @GetUserId() userId: UUID,
    @Param('missionId') missionId: string,
    @Body() data: CreateRatingDto,
  ) {
    return this.ratingsService.create(missionId, userId, data);
  }

  @Get(`mission/${SetIdParam('missionId')}`)
  @Serialize(RatingEntity)
  getByMission(@Param('missionId') missionId: string) {
    return this.ratingsService.findByMission(missionId);
  }

  // Ratings received by the authenticated user (for their profile/dashboard)
  @Get('received')
  getReceived(@GetUserId() userId: UUID) {
    return this.ratingsService.findByUser(userId);
  }

  // Avis du profil public d'un utilisateur (cohérent avec GET /users/:id et
  // /users/:id/stats, eux aussi publics).
  @Public()
  @Get(`user/${SetIdParam('userId')}`)
  getByUser(@Param('userId') userId: string) {
    return this.ratingsService.findByUser(userId);
  }
}
