import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import { OffersService } from './offers.service';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { MessageOfferEntity } from 'src/messages/entities/message-offer.entity';

@ApiTags('offers')
@ApiAuth()
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  /** Décision sur une offre : ACCEPTED déclenche la transaction atomique (mission, transaction, rejet des autres offres). */
  @Patch(ID_PARAM)
  @ApiNotFoundResponse({ description: 'Offre inconnue' })
  @ApiBadRequestResponse({
    description: 'Offre plus PENDING, ou mission déjà pourvue (course perdue)',
  })
  @ApiForbiddenResponse({
    description:
      'Non-participant, auteur de l’offre (on ne décide pas de sa propre offre), ou transporteur sans identité vérifiée (gating KYC)',
  })
  @Serialize(MessageOfferEntity)
  update(
    @Param('id') id: string,
    @GetUserId() userId: string,
    @Body() data: UpdateOfferStatusDto,
  ) {
    return this.offersService.update(id, userId, data);
  }

  @Get(`accepted/${SetIdParam('conversationId')}/last`)
  @ApiForbiddenResponse({ description: 'Non-participant de la conversation' })
  @Serialize(MessageOfferEntity)
  findLastAcceptedInConversation(
    @GetUserId() userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.offersService.findLastAccepted(conversationId, userId);
  }
}
