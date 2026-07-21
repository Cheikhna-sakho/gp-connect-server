import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from 'src/auth/auth.service';
import { createTestApp } from './helpers/e2e';

// Flux LITIGE de bout en bout, fixtures auto-contenues. Couvre la machine à
// états d'un litige et surtout le correctif sécurité M2 (une mission en litige
// ne peut PAS être annulée unilatéralement par un participant — sortie réservée
// à l'admin), ainsi que les effets de bord de la résolution (transaction
// PENDING annulée).

describe('Flux litige (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const uniq = randomUUID().slice(0, 8);
  let shipper: { id: string; token: string };
  let carrier: { id: string; token: string };
  let admin: { id: string; token: string };

  let advertisementId: string;
  let missionId: string;
  let disputeId: string;

  const asShipper = () => ({ Authorization: `Bearer ${shipper.token}` });
  const asCarrier = () => ({ Authorization: `Bearer ${carrier.token}` });
  const asAdmin = () => ({ Authorization: `Bearer ${admin.token}` });
  const srv = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DatabaseService);
    const auth = app.get(AuthService);

    const addresses = await db.address.findMany({
      take: 2,
      select: { id: true },
    });

    const mk = async (role: 'SHIPPER' | 'CARRIER' | 'ADMIN', label: string) => {
      const u = await db.user.create({
        data: {
          email: `e2e-dispute-${label}-${uniq}@test.local`,
          firstName: 'E2E',
          lastName: label,
          role,
          emailVerifiedAt: new Date(),
        },
      });
      return {
        id: u.id,
        token: auth.signAccessTokenJwt({ id: u.id as never }),
      };
    };
    shipper = await mk('SHIPPER', 'shipper');
    carrier = await mk('CARRIER', 'carrier');
    admin = await mk('ADMIN', 'admin');

    const ad = await db.advertisement.create({
      data: {
        type: 'DELIVERY',
        status: 'IN_PROGRESS',
        price: 100,
        maxWeight: 20,
        authorId: carrier.id,
        departureId: addresses[0].id,
        destinationId: addresses[1].id,
        arrivalDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    advertisementId = ad.id;

    // Mission déjà ACCEPTED avec carrier assigné + transaction PENDING (état à
    // partir duquel un litige peut être ouvert).
    const mission = await db.mission.create({
      data: {
        advertisementId: ad.id,
        shipperId: shipper.id,
        carrierId: carrier.id,
        status: 'ACCEPTED',
        negotiatedPrice: 100,
        transaction: {
          create: { amount: 100, method: 'CASH', status: 'PENDING' },
        },
      },
    });
    missionId = mission.id;
  });

  afterAll(async () => {
    try {
      await db.missionDispute.deleteMany({ where: { missionId } });
      await db.transaction.deleteMany({ where: { missionId } });
      await db.mission.deleteMany({ where: { id: missionId } });
      await db.advertisement.deleteMany({ where: { id: advertisementId } });
      await db.user.deleteMany({
        where: { id: { in: [shipper.id, carrier.id, admin.id] } },
      });
    } catch {
      // best-effort
    }
    await app.close();
  });

  it('un non-participant (admin) ne peut pas ouvrir de litige → 403', () => {
    return request(srv())
      .post(`/disputes/mission/${missionId}`)
      .set(asAdmin())
      .send({ reason: 'damaged' })
      .expect(403);
  });

  it('un motif hors liste est rejeté par la validation → 400', () => {
    return request(srv())
      .post(`/disputes/mission/${missionId}`)
      .set(asShipper())
      .send({ reason: 'je-naime-pas' })
      .expect(400);
  });

  it('un participant ouvre un litige → 201, mission passe en DISPUTED', async () => {
    const res = await request(srv())
      .post(`/disputes/mission/${missionId}`)
      .set(asShipper())
      .send({ reason: 'damaged', description: 'Colis abîmé à la livraison' })
      .expect(201);
    disputeId = res.body.id;

    const mission = await request(srv())
      .get(`/missions/${missionId}`)
      .set(asShipper())
      .expect(200);
    expect(mission.body.status).toBe('DISPUTED');
  });

  it('M2 : une mission en litige ne peut PAS être annulée par un participant → 403', () => {
    return request(srv())
      .patch(`/missions/${missionId}`)
      .set(asShipper())
      .send({ status: 'CANCELLED' })
      .expect(403);
  });

  it('2e ouverture refusée : mission déjà en litige (garde de statut) → 400', () => {
    // La mission est déjà DISPUTED → la garde de statut (ACCEPTED/IN_TRANSIT
    // requis) se déclenche avant la contrainte d'unicité. L'unicité (P2002 →
    // 409) reste couverte en unitaire ; au niveau HTTP elle est masquée par
    // cette garde, ce qui est le comportement attendu.
    return request(srv())
      .post(`/disputes/mission/${missionId}`)
      .set(asCarrier())
      .send({ reason: 'fraud', description: 'Tentative de double litige' })
      .expect(400);
  });

  it("la résolution est réservée à l'admin (participant → 403)", () => {
    return request(srv())
      .patch(`/disputes/${disputeId}`)
      .set(asShipper())
      .send({ resolution: 'Je tranche', missionOutcome: 'CANCELLED' })
      .expect(403);
  });

  it("l'admin résout (CANCELLED) → mission CANCELLED + transaction PENDING annulée", async () => {
    await request(srv())
      .patch(`/disputes/${disputeId}`)
      .set(asAdmin())
      .send({
        resolution: 'Remboursement, torts partagés',
        missionOutcome: 'CANCELLED',
      })
      .expect(200);

    const mission = await request(srv())
      .get(`/missions/${missionId}`)
      .set(asShipper())
      .expect(200);
    expect(mission.body.status).toBe('CANCELLED');

    // effet de bord : la transaction PENDING est annulée
    const tx = await db.transaction.findUnique({ where: { missionId } });
    expect(tx?.status).toBe('CANCELLED');
  });

  it('le participant peut consulter le litige de sa mission', async () => {
    const res = await request(srv())
      .get(`/disputes/mission/${missionId}`)
      .set(asCarrier())
      .expect(200);
    expect(res.body.status).toBe('RESOLVED');
  });
});
