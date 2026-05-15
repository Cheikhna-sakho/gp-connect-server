import { prismaClient } from '../configs/prisma-client';

export const CITIES = [
  { name: 'Paris',      country: 'France',  countryIsoCode: 'FR' },
  { name: 'Lyon',       country: 'France',  countryIsoCode: 'FR' },
  { name: 'Marseille',  country: 'France',  countryIsoCode: 'FR' },
  { name: 'Bordeaux',   country: 'France',  countryIsoCode: 'FR' },
  { name: 'Lille',      country: 'France',  countryIsoCode: 'FR' },
  { name: 'Nantes',     country: 'France',  countryIsoCode: 'FR' },
  { name: 'Toulouse',   country: 'France',  countryIsoCode: 'FR' },
  { name: 'Dakar',      country: 'Senegal', countryIsoCode: 'SN' },
];

export type CityMap = Record<string, string>; // name → id

export const seedCities = async (): Promise<CityMap> => {
  const map: CityMap = {};
  for (const c of CITIES) {
    const city = await prismaClient.city.create({ data: c });
    map[c.name] = city.id;
  }
  console.log(`✓ ${CITIES.length} cities`);
  return map;
};
