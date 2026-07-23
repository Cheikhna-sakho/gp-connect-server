import { PickType } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

import { UserDto } from './user.dto';

export class CreateUserDto
  extends PickType(UserDto, [
    'email',
    // 'phone' temporairement désactivé à l'inscription : pas de TWILIO_FROM
    // configuré pour l'envoi du SMS de vérification. À réactiver ensuite.
    'password',
    'firstName',
    'lastName',
    // `role` volontairement exclu : un compte s'inscrit toujours en SHIPPER
    // (défaut schéma). Le passage CARRIER se fait via PATCH /users (rôle borné).
  ])
  implements Prisma.UserCreateInput {}
