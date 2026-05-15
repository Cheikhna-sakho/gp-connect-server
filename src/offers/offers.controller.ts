import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { OffersService } from './offers.service';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UpdateOfferDto } from 'src/messages/dtos/message-offer-update.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { MessageOfferEntity } from 'src/messages/entities/message-offer.entity';

@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Patch(ID_PARAM)
  @Serialize(MessageOfferEntity)
  update(
    @Param('id') id: string,
    @GetUserId() userId: string,
    @Body() data: UpdateOfferDto,
  ) {
    return this.offersService.update(id, userId, data);
  }

  @Get(`accepted/${SetIdParam('conversationId')}/last`)
  @Serialize(MessageOfferEntity)
  findLastAcceptedInConversation(
    @Param('conversationId') conversationId: string,
  ) {
    return this.offersService.findLastAccepted(conversationId);
  }
}
