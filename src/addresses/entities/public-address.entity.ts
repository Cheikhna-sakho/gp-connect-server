import { Expose, Transform, Type } from 'class-transformer';
import { CityEntity } from './city.entity';
import { AddressEntity } from './addresses.entity';

type Source = { obj: AddressEntity };

/**
 * Vue PUBLIQUE d'une adresse, pour la sérialisation des annonces non
 * authentifiées : on n'expose QUE le niveau ville/pays — jamais la rue, le code
 * postal ni les coordonnées GPS. Suffisant pour évaluer une annonce, sans
 * révéler l'adresse exacte (ex. domicile d'un shipper). L'adresse complète
 * n'est servie qu'aux participants d'une mission (cf. MISSION_DETAIL_INCLUDE).
 * La recherche par rayon s'appuie sur la colonne PostGIS `location` côté
 * serveur, pas sur ces champs.
 */
export class PublicAddressEntity {
  @Expose() id: string;

  @Expose() cityId: string;

  @Type(() => CityEntity)
  @Expose()
  city: CityEntity;

  @Transform(({ obj }: Source) => obj.city?.country ?? '')
  @Expose()
  country: string;

  @Transform(({ obj }: Source) => obj.city?.countryIsoCode ?? '')
  @Expose()
  countryIsoCode: string;

  @Transform(({ obj }: Source) => obj.city?.name)
  @Expose()
  cityName: string;

  // Adresse « affichable » publique : ville + pays uniquement.
  @Expose()
  get formattedAddress() {
    return [this.cityName ?? '', this.country ?? ''].filter(Boolean).join(', ');
  }

  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<PublicAddressEntity>) {
    Object.assign(this, partial);
  }
}
