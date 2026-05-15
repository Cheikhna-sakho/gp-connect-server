import { prismaClient } from '../configs/prisma-client';
import { CityMap } from './1-cities.seeder';

// Coordonnées réalistes pour les villes françaises
const RAW = [
  { city: 'Paris',     lat: 48.8566,  lng: 2.3522,  zip: '75001', street: '1 Rue de Rivoli'          },
  { city: 'Paris',     lat: 48.8534,  lng: 2.3488,  zip: '75004', street: '42 Rue Saint-Antoine'      },
  { city: 'Lyon',      lat: 45.7640,  lng: 4.8357,  zip: '69001', street: '10 Place Bellecour'        },
  { city: 'Lyon',      lat: 45.7580,  lng: 4.8320,  zip: '69002', street: '5 Rue de la République'   },
  { city: 'Marseille', lat: 43.2965,  lng: 5.3698,  zip: '13001', street: '3 La Canebière'            },
  { city: 'Bordeaux',  lat: 44.8378,  lng: -0.5792, zip: '33000', street: '7 Place de la Bourse'     },
  { city: 'Lille',     lat: 50.6292,  lng: 3.0573,  zip: '59000', street: '12 Rue Faidherbe'          },
  { city: 'Nantes',    lat: 47.2184,  lng: -1.5536, zip: '44000', street: '2 Place du Commerce'      },
  { city: 'Toulouse',  lat: 43.6047,  lng: 1.4442,  zip: '31000', street: '20 Place du Capitole'     },
  { city: 'Dakar',     lat: 14.6937,  lng: -17.4441,zip: '12500', street: '1 Avenue Cheikh Anta Diop' },
];

export type AddressMap = Record<string, string>; // "City-zip" → id

export const seedAddresses = async (cities: CityMap): Promise<AddressMap> => {
  const map: AddressMap = {};

  for (const a of RAW) {
    const addr = await prismaClient.address.create({
      data: {
        street: a.street,
        zipCode: a.zip,
        latitude: a.lat,
        longitude: a.lng,
        city: { connect: { id: cities[a.city] } },
      },
    });
    map[`${a.city}-${a.zip}`] = addr.id;
  }
  console.log(`✓ ${RAW.length} addresses`);
  return map;
};
