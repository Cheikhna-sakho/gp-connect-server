import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { UpdateOfferDto } from 'src/messages/dtos/message-offer-update.dto';
import { ProofService } from 'src/proof/proof.service';

@Injectable()
export class OffersService {
  private offers: DatabaseService['messageOffer'];
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly proofs: ProofService,
  ) {
    this.offers = this.databaseService.messageOffer;
  }

  // async accept(
  //   id: string,
  //   data: { missionId: string; shipperId: string; carrierId: string },
  // ) {
  //   await this.proofs.create({
  //     missionId: data.missionId,
  //     type: 'PICKUP',
  //     createdById: data.carrierId,
  //     verifiedById: data.shipperId,
  //   });
  //   return this.offers.update({
  //     where: { id },
  //     data: {
  //       status: 'ACCEPTED',
  //     },
  //   });
  // }

  // async accept(id:string){

  // }

  findOne(id: string) {
    return this.offers.findUnique({
      where: { id },
      include: {
        mission: {
          select: {
            id: true,
            carrierId: true,
            shipperId: true,
          },
        },
      },
    });
  }
  async findAllAccepted(conversationId: string) {
    return this.offers.findMany({
      where: {
        message: { conversationId },
        status: 'ACCEPTED',
      },
    });
  }

  async findLastAccepted(conversationId: string) {
    return this.offers.findFirst({
      where: {
        message: { conversationId },
        status: 'ACCEPTED',
      },
      // orderBy:{ // commented caused createdAt not in db
      //   { createdAt: 'desc' }
      // }
    });
  }

  async update(id: string, data: UpdateOfferDto) {
    return this.offers.update({ where: { id }, data });
  }
}
