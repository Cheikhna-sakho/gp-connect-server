/**
 * Scénarios de test complets — couvre tout le flow de l'app
 *
 * 1. COMPLETED  — Marc + Thomas  Paris→Lyon  (mission terminée, notés)
 * 2. IN_TRANSIT — Alice + Thomas Paris→Marseille (colis récupéré, livraison en cours)
 * 3. ACCEPTED   — Sophie + Julie Paris→Bordeaux (offre acceptée, pickup à faire)
 * 4. NEGOTIATING — Alice + Antoine Paris→Toulouse (négociation en cours, offres échangées)
 * 5. NEW         — Sophie + Julie  Bordeaux→Paris (conversation ouverte, aucune offre)
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prismaClient } from '../configs/prisma-client';
import { AddressMap } from './3-addresses.seeder';
import { AdMap } from './4-advertisements.seeder';
import { UserMap } from './2-users.seeder';

const db = prismaClient;
const past = (days: number) => new Date(Date.now() - days * 86_400_000);
const future = (days: number) => new Date(Date.now() + days * 86_400_000);

const newMsg = (
  conversationId: string,
  authorId: string,
  content: string,
  daysAgo: number,
) =>
  db.message.create({
    data: {
      conversationId,
      authorId,
      content,
      type: 'TEXT',
      createdAt: past(daysAgo),
      updatedAt: past(daysAgo),
    },
  });

// ─── Scenario 1: COMPLETED ────────────────────────────────────────────────
// Marc (shipper) + Thomas (carrier) — Paris→Lyon — mission terminée il y a 2 jours
const scenario1 = async (users: UserMap, addresses: AddressMap, ads: AdMap) => {
  // Mission directement COMPLETED
  const mission = await db.mission.create({
    data: {
      advertisementId: ads['thomas-paris-lyon'],
      shipperId: users.marc,
      carrierId: users.thomas,
      negotiatedPrice: new Decimal(40),
      status: 'COMPLETED',
      createdAt: past(10),
      updatedAt: past(2),
    },
  });

  // Package lié à la mission (DELIVERED)
  const pkg = await db.package.create({
    data: {
      name: 'Vêtements hiver',
      description: '2 pulls + 1 manteau',
      weight: new Decimal(3),
      status: 'DELIVERED',
      ownerId: users.marc,
      mission: { create: { missionId: mission.id } },
    },
  });

  // Transaction COMPLETED
  await db.transaction.create({
    data: {
      missionId: mission.id,
      amount: new Decimal(40),
      method: 'CASH',
      status: 'COMPLETED',
    },
  });

  // Conversation ARCHIVED
  const conv = await db.conversation.create({
    data: {
      advertisementId: ads['thomas-paris-lyon'],
      shipperId: users.marc,
      carrierId: users.thomas,
      missionId: mission.id,
      status: 'ARCHIVED',
      lastMessageAt: past(2),
      createdAt: past(10),
      updatedAt: past(2),
    },
  });

  // Messages de la conversation
  await newMsg(conv.id, users.marc,   'Bonjour Thomas, j\'ai un colis de 3kg Paris→Lyon pour lundi.', 10);
  await newMsg(conv.id, users.thomas, 'Bonjour Marc ! Je peux le prendre. Mon prix est 40€.', 9);
  await newMsg(conv.id, users.marc,   'Parfait, je prends. On se retrouve à quelle heure ?', 9);
  await newMsg(conv.id, users.thomas, 'Lundi 9h place de la République ?', 8);
  await newMsg(conv.id, users.marc,   'C\'est noté. À lundi !', 8);
  await newMsg(conv.id, users.thomas, 'Livraison effectuée avec succès.', 2);

  // Ratings mutuels
  await db.missionRating.create({
    data: { missionId: mission.id, raterId: users.marc, ratedId: users.thomas, score: 5, comment: 'Parfait ! Ponctuel et très professionnel. Je recommande vivement.' },
  });
  await db.missionRating.create({
    data: { missionId: mission.id, raterId: users.thomas, ratedId: users.marc, score: 5, comment: 'Client sérieux, colis bien emballé. Merci Marc !' },
  });

  console.log('  ✓ Scenario 1: COMPLETED (Marc + Thomas, Paris→Lyon)');
};

// ─── Scenario 2: IN_TRANSIT ───────────────────────────────────────────────
// Alice (shipper) + Thomas (carrier) — Paris→Marseille — pickup fait hier
const scenario2 = async (users: UserMap, addresses: AddressMap, ads: AdMap) => {
  const mission = await db.mission.create({
    data: {
      advertisementId: ads['thomas-paris-marseille'],
      shipperId: users.alice,
      carrierId: users.thomas,
      negotiatedPrice: new Decimal(60),
      status: 'IN_TRANSIT',
      createdAt: past(5),
      updatedAt: past(1),
    },
  });

  await db.package.create({
    data: {
      name: 'Matériel photo',
      description: 'Appareil photo + objectifs, FRAGILE',
      weight: new Decimal(2.8),
      status: 'PICKED_UP',
      ownerId: users.alice,
      mission: { create: { missionId: mission.id } },
    },
  });

  await db.transaction.create({
    data: { missionId: mission.id, amount: new Decimal(60), method: 'CASH', status: 'PENDING' },
  });

  const conv = await db.conversation.create({
    data: {
      advertisementId: ads['thomas-paris-marseille'],
      shipperId: users.alice,
      carrierId: users.thomas,
      missionId: mission.id,
      status: 'ACTIVE',
      lastMessageAt: past(1),
      createdAt: past(5),
      updatedAt: past(1),
    },
  });

  await newMsg(conv.id, users.alice,  'Bonjour Thomas, j\'ai du matériel photo fragile à envoyer à Marseille.', 5);
  await newMsg(conv.id, users.thomas, 'Pas de problème, je prends grand soin des objets fragiles. 60€ ça vous va ?', 5);
  await newMsg(conv.id, users.alice,  'C\'est parfait. Je vous donne le code de ramassage.', 4);
  await newMsg(conv.id, users.thomas, 'Colis récupéré hier matin, tout est en bon état. Livraison demain.', 1);

  // Preuve pickup utilisée
  await db.missionProof.create({
    data: {
      missionId: mission.id,
      type: 'PICKUP',
      otpHash: 'used',
      otpUsedAt: past(1),
      otpExpiresAt: past(1),
      createdById: users.alice,
      verifiedById: users.thomas,
    },
  });

  console.log('  ✓ Scenario 2: IN_TRANSIT (Alice + Thomas, Paris→Marseille)');
};

// ─── Scenario 3: ACCEPTED ─────────────────────────────────────────────────
// Sophie (shipper) + Julie (carrier) — offre acceptée, pickup à faire
const scenario3 = async (users: UserMap, addresses: AddressMap, ads: AdMap) => {
  const mission = await db.mission.create({
    data: {
      advertisementId: ads['julie-paris-bordeaux'],
      shipperId: users.sophie,
      carrierId: users.julie,
      negotiatedPrice: new Decimal(50),
      status: 'ACCEPTED',
      createdAt: past(2),
      updatedAt: past(1),
    },
  });

  await db.package.create({
    data: {
      name: 'Livre de recettes',
      weight: new Decimal(1.5),
      status: 'PENDING',
      ownerId: users.sophie,
      mission: { create: { missionId: mission.id } },
    },
  });

  await db.transaction.create({
    data: { missionId: mission.id, amount: new Decimal(50), method: 'CASH', status: 'PENDING' },
  });

  const conv = await db.conversation.create({
    data: {
      advertisementId: ads['julie-paris-bordeaux'],
      shipperId: users.sophie,
      carrierId: users.julie,
      missionId: mission.id,
      status: 'ACTIVE',
      lastMessageAt: past(1),
      createdAt: past(2),
      updatedAt: past(1),
    },
  });

  // Message avec offre
  const offerMsg = await db.message.create({
    data: {
      conversationId: conv.id,
      authorId: users.sophie,
      content: 'Je propose 50€ pour 1,5kg.',
      type: 'OFFER',
      createdAt: past(2),
      updatedAt: past(2),
    },
  });
  await db.messageOffer.create({
    data: {
      id: offerMsg.id,
      price: new Decimal(50),
      weight: new Decimal(1.5),
      missionId: mission.id,
      status: 'ACCEPTED',
    },
  });

  await newMsg(conv.id, users.julie,  'Super ! J\'accepte. Pickup jeudi matin ?', 1);
  await newMsg(conv.id, users.sophie, 'Parfait pour jeudi. Je vous envoie le code demain.', 1);

  console.log('  ✓ Scenario 3: ACCEPTED (Sophie + Julie, Paris→Bordeaux)');
};

// ─── Scenario 4: NEGOTIATING ─────────────────────────────────────────────
// Alice (shipper) + Antoine (carrier) — offres en cours, pas encore accepté
const scenario4 = async (users: UserMap, addresses: AddressMap, ads: AdMap) => {
  const mission = await db.mission.create({
    data: {
      advertisementId: ads['antoine-toulouse-paris'],
      shipperId: users.alice,
      carrierId: null,
      status: 'PENDING',
      createdAt: past(1),
      updatedAt: past(1),
    },
  });

  const conv = await db.conversation.create({
    data: {
      advertisementId: ads['antoine-toulouse-paris'],
      shipperId: users.alice,
      carrierId: users.antoine,
      missionId: mission.id,
      status: 'ACTIVE',
      lastMessageAt: past(0),
      createdAt: past(1),
      updatedAt: past(0),
    },
  });

  await newMsg(conv.id, users.alice,   'Bonjour Antoine ! Vous pouvez prendre 4kg Paris→Toulouse ?', 1);
  await newMsg(conv.id, users.antoine, 'Bonjour ! Oui, je passe le week-end. Mon prix habituel c\'est 70€.', 1);

  // Offre d'Alice counter-offer
  const offerMsg1 = await db.message.create({
    data: {
      conversationId: conv.id,
      authorId: users.alice,
      content: '',
      type: 'OFFER',
      createdAt: past(0),
      updatedAt: past(0),
    },
  });
  await db.messageOffer.create({
    data: {
      id: offerMsg1.id,
      price: new Decimal(55),
      weight: new Decimal(4),
      status: 'PENDING',
    },
  });

  await newMsg(conv.id, users.antoine, 'Je peux faire 60€ et pas moins, j\'ai de l\'essence à payer 😅', 0);

  console.log('  ✓ Scenario 4: NEGOTIATING (Alice + Antoine, Paris→Toulouse)');
};

// ─── Scenario 5: NEW conversation ─────────────────────────────────────────
// Marc (shipper) ouvre une conversation sur l'annonce de Julie, rien encore
const scenario5 = async (users: UserMap, addresses: AddressMap, ads: AdMap) => {
  const mission = await db.mission.create({
    data: {
      advertisementId: ads['julie-lille-paris'],
      shipperId: users.marc,
      carrierId: null,
      status: 'PENDING',
      createdAt: past(0),
      updatedAt: past(0),
    },
  });

  const conv = await db.conversation.create({
    data: {
      advertisementId: ads['julie-lille-paris'],
      shipperId: users.marc,
      carrierId: users.julie,
      missionId: mission.id,
      status: 'ACTIVE',
      lastMessageAt: past(0),
      createdAt: past(0),
      updatedAt: past(0),
    },
  });

  await newMsg(conv.id, users.marc, 'Bonjour Julie ! J\'ai un petit colis de 1kg de Lille vers Paris demain, c\'est possible ?', 0);

  console.log('  ✓ Scenario 5: NEW conversation (Marc + Julie, Lille→Paris)');
};

// ─── Orchestrateur ────────────────────────────────────────────────────────
export const seedScenarios = async (
  users: UserMap,
  addresses: AddressMap,
  ads: AdMap,
) => {
  console.log('  Seeding scenarios...');
  await scenario1(users, addresses, ads);
  await scenario2(users, addresses, ads);
  await scenario3(users, addresses, ads);
  await scenario4(users, addresses, ads);
  await scenario5(users, addresses, ads);
  console.log('✓ All scenarios seeded');
};
