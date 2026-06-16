import { $Enums } from '@prisma/client';
import { IsIn } from 'class-validator';

// Corps de PATCH /offers/:id : on ne laisse changer QUE le statut (accepter /
// refuser). Volontairement, ni price/weight (sinon un participant pourrait
// réécrire le prix de l'offre de l'autre puis l'accepter), ni missionId
// (positionné côté serveur à l'acceptation).
export class UpdateOfferStatusDto {
  @IsIn([
    $Enums.MessageOfferStatus.ACCEPTED,
    $Enums.MessageOfferStatus.REJECTED,
  ])
  status: $Enums.MessageOfferStatus;
}
