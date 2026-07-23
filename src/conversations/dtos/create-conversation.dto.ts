import { PickType } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsEmpty, IsUUID } from 'class-validator';
import { MissionDto } from 'src/missions/dtos/mission.dto';

export class CreateConversationDto
  extends PickType(MissionDto, ['packageIds'])
  implements Prisma.ConversationUncheckedCreateInput
{
  @IsUUID()
  advertisementId: string;
  @IsEmpty()
  shipperId: string;
  @IsEmpty()
  carrierId: string;

  // Dérivé côté serveur (mission-dossier de l'annonce pour SHIPPING, sinon
  // nouvelle mission). Jamais fourni par le client : sinon on pourrait
  // rattacher la conversation à une mission arbitraire et la détourner à
  // l'acceptation d'une offre.
  @IsEmpty()
  missionId: string;
}
