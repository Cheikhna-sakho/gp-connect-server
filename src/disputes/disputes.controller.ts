import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UUID } from 'crypto';
import { CreateDisputeDto } from './dtos/create-dispute.dto';
import { ResolveDisputeDto } from './dtos/resolve-dispute.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { DisputeEntity } from './entities/dispute.entity';
import { SetIdParam } from 'src/common/constants/route.util.const';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { Roles } from 'src/auth/decorators/role.decorator';

@ApiTags('disputes')
@ApiAuth()
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  // Open a dispute on a mission (shipper or carrier)
  @ApiNotFoundResponse({ description: 'Mission inconnue' })
  @ApiForbiddenResponse({ description: 'Non-participant de la mission' })
  @ApiBadRequestResponse({
    description: 'Statut de mission hors ACCEPTED/IN_TRANSIT',
  })
  @ApiConflictResponse({
    description: 'Un litige est déjà ouvert sur cette mission',
  })
  @Post(`mission/${SetIdParam('missionId')}`)
  @Serialize(DisputeEntity)
  create(
    @GetUserId() userId: UUID,
    @Param('missionId') missionId: string,
    @Body() data: CreateDisputeDto,
  ) {
    return this.disputesService
      .create(missionId, userId, data)
      .then(([dispute]) => dispute);
  }

  // Get the dispute for a mission (participant only)
  @Get(`mission/${SetIdParam('missionId')}`)
  @Serialize(DisputeEntity)
  getByMission(
    @GetUserId() userId: UUID,
    @Param('missionId') missionId: string,
  ) {
    return this.disputesService.findByMission(missionId, userId);
  }

  // Admin: resolve a dispute (le listing passe par le back-office AdminJS)
  /** Résolution admin : mission terminée ou annulée + emails aux parties + fermeture de l'issue GitHub. */
  @ApiForbiddenResponse({ description: 'Rôle ADMIN requis' })
  @ApiBadRequestResponse({
    description: 'Litige déjà résolu (verrou optimiste)',
  })
  @Patch(SetIdParam('id'))
  @Serialize(DisputeEntity)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  resolve(
    @GetUserId() adminId: UUID,
    @Param('id') id: string,
    @Body() data: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(id, adminId, data);
  }
}
