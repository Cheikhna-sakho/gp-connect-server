import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { DatabaseModule } from 'src/database/database.module';

// Pas de contrôleur : les adresses portent de la PII (rue + coordonnées) et ne
// s'exposent pas en CRUD public. Elles se créent via les annonces
// (createIfNotExist) et se consultent via /users/me/saved-addresses.
@Module({
  providers: [AddressesService],
  exports: [AddressesService],
  imports: [DatabaseModule],
})
export class AddressesModule {}
