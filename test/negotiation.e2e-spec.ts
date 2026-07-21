import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from 'src/auth/auth.service';
import { createTestApp } from './helpers/e2e';

// Négociation de bout en bout via l'API réelle : ouverture de conversation sur
// une annonce, échange de messages TEXT, garde de participation, offre au-delà
// du poids max (refusée), offre valide, puis acceptation par le shipper — le
// tout avec fixtures AUTO-CONTENUES (aucune conversation/mission créée en base :
// elles naissent via l'API pendant le test) et nettoyage best-effort.

describe('Négociation (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const uniq = randomUUID().slice(0, 8);
  let shipper: { id: string; token: string };
  let carrier: { id: string; token: string };
  let outsider: { id: string; token: string };

  // fixtures / ids créés via l'API, pour le nettoyage
  let advertisementId: string;
  let conversationId: string;
  let missionId: string;
  let offerId: string;

  const asShipper = () => ({ Authorization: `Bearer ${shipper.token}` });
  const asCarrier = () => ({ Authorization: `Bearer ${carrier.token}` });
  const asOutsider = () => ({ Authorization: `Bearer ${outsider.token}` });
  const srv = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DatabaseService);
    const auth = app.get(AuthService);

    // 2 adresses existantes réutilisées (ressources partagées → pas de pollution)
    const addresses = await db.address.findMany({
      take: 2,
      select: { id: true },
    });
    expect(addresses.length).toBe(2);

    const shipperUser = await db.user.create({
      data: {
        email: `e2e-nego-shipper-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'ShipperNego',
        role: 'SHIPPER',
        emailVerifiedAt: new Date(),
      },
    });
    const carrierUser = await db.user.create({
      data: {
        email: `e2e-nego-carrier-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'CarrierNego',
        role: 'CARRIER',
        emailVerifiedAt: new Date(),
        // KYC VÉRIFIÉ : l'acceptation ne doit PAS être bloquée par le gate KYC
        idCardVerifiedAt: new Date(),
      },
    });
    const outsiderUser = await db.user.create({
      data: {
        email: `e2e-nego-outsider-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'Outsider',
        role: 'SHIPPER',
        emailVerifiedAt: new Date(),
      },
    });

    shipper = {
      id: shipperUser.id,
      token: auth.signAccessTokenJwt({ id: shipperUser.id as never }),
    };
    carrier = {
      id: carrierUser.id,
      token: auth.signAccessTokenJwt({ id: carrierUser.id as never }),
    };
    outsider = {
      id: outsiderUser.id,
      token: auth.signAccessTokenJwt({ id: outsiderUser.id as never }),
    };

    // Annonce DELIVERY authored par le carrier : c'est le shipper qui ouvrira
    // la conversation dessus.
    const ad = await db.advertisement.create({
      data: {
        type: 'DELIVERY',
        status: 'OPEN',
        price: 100,
        maxWeight: 10,
        authorId: carrierUser.id,
        departureId: addresses[0].id,
        destinationId: addresses[1].id,
        arrivalDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    advertisementId = ad.id;
  });

  afterAll(async () => {
    try {
      await db.missionRating.deleteMany({ where: { missionId } });
      await db.transaction.deleteMany({ where: { missionId } });
      await db.missionProof.deleteMany({ where: { missionId } });
      await db.missionPackage.deleteMany({ where: { missionId } });
      await db.messageOffer.deleteMany({
        where: { message: { conversationId } },
      });
      await db.message.deleteMany({ where: { conversationId } });
      await db.conversation.deleteMany({ where: { id: conversationId } });
      await db.mission.deleteMany({ where: { id: missionId } });
      await db.advertisement.deleteMany({ where: { id: advertisementId } });
      await db.user.deleteMany({
        where: { id: { in: [shipper.id, carrier.id, outsider.id] } },
      });
    } catch {
      // best-effort : ne pas masquer un échec de test par un échec de nettoyage
    }
    await app.close();
  });

  // ─── Ouverture de la conversation ──────────────────────────────────────────

  it("le shipper ouvre une conversation sur l'annonce du carrier → 201 (+ mission-dossier créée)", async () => {
    const res = await request(srv())
      .post('/conversations')
      .set(asShipper())
      .send({ advertisementId })
      .expect(201);

    conversationId = res.body.id;
    expect(conversationId).toBeTruthy();

    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
    });
    expect(conv).toBeTruthy();
    expect(conv!.shipperId).toBe(shipper.id);
    expect(conv!.carrierId).toBe(carrier.id);
    missionId = conv!.missionId!;
    expect(missionId).toBeTruthy();
  });

  // ─── Messages TEXT + garde de participation ────────────────────────────────

  it('le shipper envoie un message TEXT → 201', () => {
    return request(srv())
      .post('/messages')
      .set(asShipper())
      .send({ conversationId, type: 'TEXT', content: 'Bonjour, dispo ?' })
      .expect(201);
  });

  it('un non-participant ne peut PAS écrire dans la conversation → 403', () => {
    return request(srv())
      .post('/messages')
      .set(asOutsider())
      .send({ conversationId, type: 'TEXT', content: 'intrusion' })
      .expect(403);
  });

  // ─── Offres ────────────────────────────────────────────────────────────────

  it("une offre au-delà du poids max de l'annonce est refusée → 400", () => {
    return request(srv())
      .post('/messages')
      .set(asCarrier())
      .send({
        conversationId,
        type: 'OFFER',
        offer: { price: 100, weight: 20 },
      })
      .expect(400);
  });

  it('le carrier fait une offre valide (poids ≤ max) → 201', async () => {
    const res = await request(srv())
      .post('/messages')
      .set(asCarrier())
      .send({ conversationId, type: 'OFFER', offer: { price: 100, weight: 5 } })
      .expect(201);

    expect(res.body.offer).toBeTruthy();
    offerId = res.body.offer.id;
    expect(offerId).toBeTruthy();
  });

  it('le carrier ne peut pas accepter sa PROPRE offre → 403', () => {
    return request(srv())
      .patch(`/offers/${offerId}`)
      .set(asCarrier())
      .send({ status: 'ACCEPTED' })
      .expect(403);
  });

  it("le shipper accepte l'offre → 200 (mission ACCEPTED)", async () => {
    await request(srv())
      .patch(`/offers/${offerId}`)
      .set(asShipper())
      .send({ status: 'ACCEPTED' })
      .expect(200);

    const mission = await request(srv())
      .get(`/missions/${missionId}`)
      .set(asShipper())
      .expect(200);
    expect(mission.body.status).toBe('ACCEPTED');
  });
});
