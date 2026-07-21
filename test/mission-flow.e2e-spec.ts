import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from 'src/auth/auth.service';
import { createTestApp } from './helpers/e2e';

// Flux critique de bout en bout, avec fixtures AUTO-CONTENUES : le test crée ses
// propres utilisateurs / annonce / colis / conversation / offre (aucune
// dépendance à l'état seed partagé), déroule tout le cycle métier via l'API
// réelle, puis nettoie. C'est le test qui prouve que le cœur du produit —
// acceptation atomique + gate KYC + double OTP → COMPLETED — fonctionne
// réellement contre une vraie base (ce qu'aucun unitaire ne peut garantir).

describe('Flux mission complet (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const uniq = randomUUID().slice(0, 8);
  let shipper: { id: string; token: string };
  let carrier: { id: string; token: string };

  // ids des fixtures, pour le nettoyage
  let advertisementId: string;
  let packageId: string;
  let missionId: string;
  let conversationId: string;
  let offerId: string;

  // codes OTP capturés en cours de flux
  let pickupCode: string;
  let deliveryCode: string;

  const asShipper = () => ({ Authorization: `Bearer ${shipper.token}` });
  const asCarrier = () => ({ Authorization: `Bearer ${carrier.token}` });
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
        email: `e2e-shipper-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'Shipper',
        role: 'SHIPPER',
        emailVerifiedAt: new Date(),
      },
    });
    const carrierUser = await db.user.create({
      data: {
        email: `e2e-carrier-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'Carrier',
        role: 'CARRIER',
        emailVerifiedAt: new Date(),
        // idCardVerifiedAt VOLONTAIREMENT absent → on teste d'abord le gate KYC
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

    const ad = await db.advertisement.create({
      data: {
        type: 'DELIVERY',
        status: 'OPEN',
        price: 120,
        maxWeight: 20,
        authorId: carrierUser.id,
        departureId: addresses[0].id,
        destinationId: addresses[1].id,
        arrivalDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    advertisementId = ad.id;

    const pkg = await db.package.create({
      data: { name: 'Colis E2E', weight: 3, ownerId: shipperUser.id },
    });
    packageId = pkg.id;

    const mission = await db.mission.create({
      data: {
        advertisementId: ad.id,
        shipperId: shipperUser.id,
        status: 'PENDING',
        packages: { create: { packageId: pkg.id } },
      },
    });
    missionId = mission.id;

    const conversation = await db.conversation.create({
      data: {
        advertisementId: ad.id,
        shipperId: shipperUser.id,
        carrierId: carrierUser.id,
        missionId: mission.id,
      },
    });
    conversationId = conversation.id;

    // offre PENDING faite par le carrier (montant total 120 pour 3 kg)
    const msg = await db.message.create({
      data: {
        conversationId: conversation.id,
        authorId: carrierUser.id,
        type: 'OFFER',
        offer: { create: { price: 120, weight: 3 } },
      },
      include: { offer: true },
    });
    offerId = msg.offer!.id;
  });

  afterAll(async () => {
    try {
      await db.missionRating.deleteMany({ where: { missionId } });
      await db.transaction.deleteMany({ where: { missionId } });
      await db.missionProof.deleteMany({ where: { missionId } });
      await db.missionPackage.deleteMany({ where: { missionId } });
      await db.messageOffer.deleteMany({ where: { id: offerId } });
      await db.message.deleteMany({ where: { conversationId } });
      await db.conversation.deleteMany({ where: { id: conversationId } });
      await db.mission.deleteMany({ where: { id: missionId } });
      await db.advertisement.deleteMany({ where: { id: advertisementId } });
      await db.package.deleteMany({ where: { id: packageId } });
      await db.user.deleteMany({
        where: { id: { in: [shipper.id, carrier.id] } },
      });
    } catch {
      // best-effort : ne pas masquer un échec de test par un échec de nettoyage
    }
    await app.close();
  });

  // ─── Acceptation ──────────────────────────────────────────────────────────

  it("gate KYC : le shipper ne peut PAS accepter tant que le carrier n'est pas vérifié → 403", () => {
    return request(srv())
      .patch(`/offers/${offerId}`)
      .set(asShipper())
      .send({ status: 'ACCEPTED' })
      .expect(403);
  });

  it('le carrier ne peut pas accepter sa PROPRE offre → 403', () => {
    return request(srv())
      .patch(`/offers/${offerId}`)
      .set(asCarrier())
      .send({ status: 'ACCEPTED' })
      .expect(403);
  });

  it('après vérification KYC du carrier, le shipper accepte → 200 (mission ACCEPTED + transaction PENDING)', async () => {
    await db.user.update({
      where: { id: carrier.id },
      data: { idCardVerifiedAt: new Date() },
    });

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

    const tx = await request(srv())
      .get(`/transactions/mission/${missionId}`)
      .set(asCarrier()) // le carrier voit aussi sa transaction
      .expect(200);
    expect(tx.body.status).toBe('PENDING');
    expect(Number(tx.body.amount)).toBe(120);
  });

  // ─── Ramassage ────────────────────────────────────────────────────────────

  it('générer un code de livraison AVANT le ramassage est refusé → 400', () => {
    return request(srv())
      .post(`/missions/${missionId}/proof/delivery`)
      .set(asShipper())
      .expect(400);
  });

  it('le shipper génère le code de ramassage → 200 (+ code renvoyé)', async () => {
    const res = await request(srv())
      .post(`/missions/${missionId}/proof/pickup`)
      .set(asShipper())
      .expect(201);
    expect(res.body.code).toMatch(/^\d{6}$/);
    pickupCode = res.body.code;
  });

  it('un mauvais code de ramassage est rejeté → 400', () => {
    return request(srv())
      .post(`/missions/${missionId}/verify/pickup`)
      .set(asCarrier())
      .send({ code: '000000' })
      .expect(400);
  });

  it('le carrier saisit le bon code → mission IN_TRANSIT', async () => {
    await request(srv())
      .post(`/missions/${missionId}/verify/pickup`)
      .set(asCarrier())
      .send({ code: pickupCode })
      .expect(201);

    const mission = await request(srv())
      .get(`/missions/${missionId}`)
      .set(asCarrier())
      .expect(200);
    expect(mission.body.status).toBe('IN_TRANSIT');
  });

  // ─── Livraison ────────────────────────────────────────────────────────────

  it('le shipper génère le code de livraison (pas de destinataire → code renvoyé)', async () => {
    const res = await request(srv())
      .post(`/missions/${missionId}/proof/delivery`)
      .set(asShipper())
      .expect(201);
    expect(res.body.sentToRecipient).toBe(false);
    expect(res.body.code).toMatch(/^\d{6}$/);
    deliveryCode = res.body.code;
  });

  it('le carrier saisit le code de livraison → mission COMPLETED + transaction COMPLETED', async () => {
    await request(srv())
      .post(`/missions/${missionId}/verify/delivery`)
      .set(asCarrier())
      .send({ code: deliveryCode })
      .expect(201);

    const mission = await request(srv())
      .get(`/missions/${missionId}`)
      .set(asShipper())
      .expect(200);
    expect(mission.body.status).toBe('COMPLETED');

    const tx = await request(srv())
      .get(`/transactions/mission/${missionId}`)
      .set(asShipper())
      .expect(200);
    expect(tx.body.status).toBe('COMPLETED');
  });

  // ─── Notation bidirectionnelle ────────────────────────────────────────────

  it('les deux parties se notent (mission COMPLETED) → 201, et la note est lisible', async () => {
    await request(srv())
      .post(`/ratings/mission/${missionId}`)
      .set(asShipper())
      .send({ score: 5, comment: 'Parfait' })
      .expect(201);

    await request(srv())
      .post(`/ratings/mission/${missionId}`)
      .set(asCarrier())
      .send({ score: 4 })
      .expect(201);

    const ratings = await request(srv())
      .get(`/ratings/mission/${missionId}`)
      .set(asShipper())
      .expect(200);
    expect(ratings.body).toHaveLength(2);
  });

  it('on ne peut pas noter deux fois la même mission → 409', () => {
    return request(srv())
      .post(`/ratings/mission/${missionId}`)
      .set(asShipper())
      .send({ score: 3 })
      .expect(409);
  });
});
