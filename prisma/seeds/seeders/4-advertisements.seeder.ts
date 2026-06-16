import { faker } from '@faker-js/faker/locale/fr';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaClient } from '../configs/prisma-client';
import { AddressMap } from './3-addresses.seeder';
import { UserMap } from './2-users.seeder';

faker.seed(42); // Reproductible

const future = (days: number) => new Date(Date.now() + days * 86_400_000);
const past = (days: number) => new Date(Date.now() - days * 86_400_000);

export type AdMap = Record<string, string>; // label → id

export const seedAdvertisements = async (
  users: UserMap,
  addresses: AddressMap,
): Promise<{ ads: AdMap; packages: string[] }> => {
  const ads: AdMap = {};
  const packages: string[] = [];
  const db = prismaClient;

  // ─── SHIPPING ads (carriers announcing their routes) ────────────────────

  // Thomas: Paris → Lyon  (OPEN, départ dans 3 jours)
  const thomasPL = await db.advertisement.create({
    data: {
      type: 'SHIPPING',
      status: 'OPEN',
      authorId: users.thomas,
      departureId: addresses['Paris-75001'],
      destinationId: addresses['Lyon-69001'],
      price: new Decimal(45),
      maxWeight: new Decimal(15),
      departureDate: future(3),
      arrivalDate: future(3),
    },
  });
  ads['thomas-paris-lyon'] = thomasPL.id;

  // Thomas: Paris → Marseille  (OPEN, départ dans 7 jours)
  const thomasPM = await db.advertisement.create({
    data: {
      type: 'SHIPPING',
      status: 'OPEN',
      authorId: users.thomas,
      departureId: addresses['Paris-75001'],
      destinationId: addresses['Marseille-13001'],
      price: new Decimal(65),
      maxWeight: new Decimal(20),
      departureDate: future(7),
      arrivalDate: future(7),
    },
  });
  ads['thomas-paris-marseille'] = thomasPM.id;

  // Julie: Lille → Paris  (OPEN, départ demain)
  const julieLiP = await db.advertisement.create({
    data: {
      type: 'SHIPPING',
      status: 'OPEN',
      authorId: users.julie,
      departureId: addresses['Lille-59000'],
      destinationId: addresses['Paris-75001'],
      price: new Decimal(35),
      maxWeight: new Decimal(10),
      departureDate: future(1),
      arrivalDate: future(1),
    },
  });
  ads['julie-lille-paris'] = julieLiP.id;

  // Julie: Paris → Bordeaux  (OPEN, dans 5 jours)
  const juliePB = await db.advertisement.create({
    data: {
      type: 'SHIPPING',
      status: 'OPEN',
      authorId: users.julie,
      departureId: addresses['Paris-75004'],
      destinationId: addresses['Bordeaux-33000'],
      price: new Decimal(55),
      maxWeight: new Decimal(12),
      departureDate: future(5),
      arrivalDate: future(5),
    },
  });
  ads['julie-paris-bordeaux'] = juliePB.id;

  // Antoine: Toulouse → Paris  (OPEN, dans 4 jours)
  const antoineTouP = await db.advertisement.create({
    data: {
      type: 'SHIPPING',
      status: 'OPEN',
      authorId: users.antoine,
      departureId: addresses['Toulouse-31000'],
      destinationId: addresses['Paris-75001'],
      price: new Decimal(70),
      maxWeight: new Decimal(25),
      departureDate: future(4),
      arrivalDate: future(4),
    },
  });
  ads['antoine-toulouse-paris'] = antoineTouP.id;

  // Thomas: Paris → Lyon  IN_PROGRESS (mission active)
  const thomasPL2 = await db.advertisement.create({
    data: {
      type: 'SHIPPING',
      status: 'IN_PROGRESS',
      authorId: users.thomas,
      departureId: addresses['Paris-75001'],
      destinationId: addresses['Lyon-69002'],
      price: new Decimal(40),
      maxWeight: new Decimal(8),
      departureDate: past(1),
      arrivalDate: future(1),
    },
  });
  ads['thomas-paris-lyon-active'] = thomasPL2.id;

  // ─── DELIVERY ads (shippers looking for carriers) ────────────────────────

  // Alice: Paris → Nantes  (OPEN)
  const alicePN = await db.advertisement.create({
    data: {
      type: 'DELIVERY',
      status: 'OPEN',
      authorId: users.alice,
      departureId: addresses['Paris-75001'],
      destinationId: addresses['Nantes-44000'],
      price: new Decimal(30),
      maxWeight: new Decimal(0),
      arrivalDate: future(10),
    },
  });
  ads['alice-paris-nantes'] = alicePN.id;

  // Marc: Paris → Lyon  (OPEN) — les packages seront attachés à la mission
  const marcPL = await db.advertisement.create({
    data: {
      type: 'DELIVERY',
      status: 'OPEN',
      authorId: users.marc,
      departureId: addresses['Paris-75004'],
      destinationId: addresses['Lyon-69001'],
      price: new Decimal(25),
      maxWeight: new Decimal(0),
      arrivalDate: future(5),
    },
  });
  ads['marc-paris-lyon'] = marcPL.id;

  // Sophie: Bordeaux → Paris  (OPEN)
  const sophieBP = await db.advertisement.create({
    data: {
      type: 'DELIVERY',
      status: 'OPEN',
      authorId: users.sophie,
      departureId: addresses['Bordeaux-33000'],
      destinationId: addresses['Paris-75001'],
      price: new Decimal(40),
      maxWeight: new Decimal(0),
      arrivalDate: future(8),
    },
  });
  ads['sophie-bordeaux-paris'] = sophieBP.id;

  // ─── Packages pour les DELIVERY ads ─────────────────────────────────────

  const pkg1 = await db.package.create({
    data: {
      name: 'Carton vêtements',
      description: 'Habits d\'été, fragile',
      ownerId: users.alice,
    },
  });
  packages.push(pkg1.id);

  const pkg2 = await db.package.create({
    data: {
      name: 'Colis Amazon',
      description: 'Électronique, bien emballer',
      ownerId: users.marc,
    },
  });
  packages.push(pkg2.id);

  const pkg3 = await db.package.create({
    data: {
      name: 'Livre cuisine',
      description: null,
      ownerId: users.sophie,
    },
  });
  packages.push(pkg3.id);

  // Extra packages aléatoires avec faker
  for (let i = 0; i < 8; i++) {
    const owner = [users.alice, users.marc, users.sophie][i % 3];
    const pkg = await db.package.create({
      data: {
        name: faker.commerce.productName(),
        description: faker.helpers.maybe(() => faker.commerce.productDescription(), { probability: 0.6 }),
        ownerId: owner,
      },
    });
    packages.push(pkg.id);
  }

  console.log(`✓ ${Object.keys(ads).length} advertisements, ${packages.length} packages`);
  return { ads, packages };
};
