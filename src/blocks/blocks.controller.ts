import { ApiBadRequestResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { SetIdParam } from 'src/common/constants/route.util.const';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { PublicUserEntity } from 'src/users/entities/public-user.entity';

@ApiTags('blocks')
@ApiAuth()
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  // Liste des utilisateurs que J'AI bloqués.
  @Get()
  @Serialize(PublicUserEntity)
  list(@GetUserId() userId: string) {
    return this.blocksService.list(userId);
  }

  @ApiBadRequestResponse({ description: 'Auto-blocage refusé' })
  @Post(SetIdParam('userId'))
  @HttpCode(HttpStatus.NO_CONTENT)
  async block(
    @GetUserId() userId: string,
    @Param('userId') targetId: string,
  ): Promise<void> {
    await this.blocksService.block(userId, targetId);
  }

  @Delete(SetIdParam('userId'))
  @HttpCode(HttpStatus.NO_CONTENT)
  unblock(@GetUserId() userId: string, @Param('userId') targetId: string) {
    return this.blocksService.unblock(userId, targetId);
  }
}
