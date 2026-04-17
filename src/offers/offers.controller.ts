import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { OffersService } from './offers.service';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UpdateOfferDto } from 'src/messages/dtos/message-offer-update.dto';

@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Patch(ID_PARAM)
  async update(
    @Param('id') id: string,
    @GetUserId() userId: string,
    @Body() data: UpdateOfferDto,
  ) {
    return this.offersService.update(id, data);
  }

  // @Get(`accepted/${SetIdParam('conversationId')}`)
  // async findAcceptedInConversation(
  //   @Param('conversationIdd') conversationId: string,
  // ) {
  //   return this.offersService.findAllAccepted(conversationId);
  // }

  @Get(`accepted/${SetIdParam('conversationId')}/last`)
  async findLastAcceptedInConversation(
    @Param('conversationId') conversationId: string,
  ) {
    return this.offersService.findLastAccepted(conversationId);
  }

  // @Patch(`${ID_PARAM}/accept`)
  // async accept(){
  //   return this.offersService.accept();
  // }
}
