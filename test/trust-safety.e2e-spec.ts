import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from 'src/auth/auth.service';
import { createTestApp } from './helpers/e2e';

// Trust & Safety de bout en bout, avec fixtures AUTO-CONTENUES : le test crée
// ses propres utilisateurs (SHIPPER / CARRIER / ADMIN) et une annonce, puis
// déroule les deux mécanismes de protection via l'API réelle :
//  - BLOCAGE : un utilisateur peut bloquer/débloquer un autre, et un blocage
//    (dans un sens OU l'autre) empêche l'ouverture d'une conversation ;
//  - SIGNALEMENT : tout utilisateur signale, seul l'ADMIN liste/résout.
// C'est la preuve, contre une vraie base, que ces gardes fonctionnent réellement.

describe('Trust & Safety : blocage + signalement (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const uniq = randomUUID().slice(0, 8);
  let shipper: { id: string; token: string }; // S
  let carrier: { id: string; token: string }; // C (auteur de l'annonce)
  let admin: { id: string; token: string }; // A

  // ids des fixtures, pour le nettoyage
  let advertisementId: string;
  let reportId: string;

  const asShipper = () => ({ Authorization: `Bearer ${shipper.token}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
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
        email: `e2e-ts-shipper-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'Shipper',
        role: 'SHIPPER',
        emailVerifiedAt: new Date(),
      },
    });
    const carrierUser = await db.user.create({
      data: {
        email: `e2e-ts-carrier-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'Carrier',
        role: 'CARRIER',
        emailVerifiedAt: new Date(),
      },
    });
    const adminUser = await db.user.create({
      data: {
        email: `e2e-ts-admin-${uniq}@test.local`,
        firstName: 'E2E',
        lastName: 'Admin',
        role: 'ADMIN',
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
    admin = {
      id: adminUser.id,
      token: auth.signAccessTokenJwt({ id: adminUser.id as never }),
    };

    const ad = await db.advertisement.create({
      data: {
        type: 'DELIVERY',
        status: 'OPEN',
        price: 100,
        maxWeight: 20,
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
      const ids = [shipper.id, carrier.id, admin.id];
      // Enfants → parents. L'étape de déblocage crée une conversation (et une
      // mission-dossier) sur l'annonce : on nettoie tout ça AVANT l'annonce.
      await db.report.deleteMany({ where: { reporterId: { in: ids } } });
      await db.userBlock.deleteMany({ where: { blockerId: { in: ids } } });
      await db.message.deleteMany({
        where: { conversation: { advertisementId } },
      });
      await db.missionPackage.deleteMany({
        where: { mission: { advertisementId } },
      });
      await db.conversation.deleteMany({ where: { advertisementId } });
      await db.mission.deleteMany({ where: { advertisementId } });
      await db.advertisement.deleteMany({ where: { id: advertisementId } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    } catch {
      // best-effort : ne pas masquer un échec de test par un échec de nettoyage
    }
    await app.close();
  });

  // ─── Blocage ────────────────────────────────────────────────────────────────

  it('anti self-block : S ne peut pas se bloquer lui-même → 400', () => {
    return request(srv())
      .post(`/blocks/${shipper.id}`)
      .set(asShipper())
      .expect(400);
  });

  it('S bloque C → 204', () => {
    return request(srv())
      .post(`/blocks/${carrier.id}`)
      .set(asShipper())
      .expect(204);
  });

  it("enforcement : S (ayant bloqué C) ne peut pas ouvrir de conversation sur l'annonce de C → 403", () => {
    return request(srv())
      .post('/conversations')
      .set(asShipper())
      .send({ advertisementId })
      .expect(403);
  });

  it('GET /blocks (en tant que S) contient C', async () => {
    const res = await request(srv())
      .get('/blocks')
      .set(asShipper())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((u: { id: string }) => u.id)).toContain(carrier.id);
  });

  it('S débloque C → 204, puis la conversation redevient possible → 201', async () => {
    await request(srv())
      .delete(`/blocks/${carrier.id}`)
      .set(asShipper())
      .expect(204);

    const res = await request(srv())
      .post('/conversations')
      .set(asShipper())
      .send({ advertisementId })
      .expect(201);
    expect(res.body.id).toBeDefined();
  });

  // ─── Signalement ──────────────────────────────────────────────────────────────

  it('anti self-report : S ne peut pas se signaler lui-même → 400', () => {
    return request(srv())
      .post('/reports')
      .set(asShipper())
      .send({ targetType: 'USER', targetId: shipper.id, reason: 'OTHER' })
      .expect(400);
  });

  it('S signale C → 201', async () => {
    const res = await request(srv())
      .post('/reports')
      .set(asShipper())
      .send({
        targetType: 'USER',
        targetId: carrier.id,
        reason: 'SCAM',
        description: 'Comportement frauduleux signalé par S',
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('OPEN');
    reportId = res.body.id;
  });

  it('non-admin : GET /reports en tant que S → 403', () => {
    return request(srv()).get('/reports').set(asShipper()).expect(403);
  });

  it('admin liste : GET /reports?status=OPEN → 200, contient le report créé', async () => {
    const res = await request(srv())
      .get('/reports?status=OPEN')
      .set(asAdmin())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((r: { id: string }) => r.id)).toContain(reportId);
  });

  it('admin résout : PATCH /reports/:id → 200 (REVIEWED)', async () => {
    const res = await request(srv())
      .patch(`/reports/${reportId}`)
      .set(asAdmin())
      .send({ status: 'REVIEWED', resolution: 'Traité' })
      .expect(200);
    expect(res.body.status).toBe('REVIEWED');
  });
});
