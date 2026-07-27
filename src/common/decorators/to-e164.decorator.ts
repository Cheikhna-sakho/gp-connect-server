import { Transform } from 'class-transformer';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Normalise un numéro en E.164 strict AVANT validation : « +33 7 63 93 34 58 »
// et « +33763933458 » doivent produire la même chaîne en base (contrainte
// @unique, lookup au login, envoi Twilio). Une valeur non parsable (email,
// numéro invalide) est laissée telle quelle : c'est @IsPhoneNumber qui la
// rejette avec le bon message — ce décorateur ne valide pas, il canonise.
export const ToE164 = () =>
  Transform(({ value }) =>
    typeof value === 'string'
      ? parsePhoneNumberFromString(value)?.number ?? value
      : value,
  );
