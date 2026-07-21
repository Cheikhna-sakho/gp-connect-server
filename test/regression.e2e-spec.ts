import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from 'src/database/database.service';
import {
  createTestApp,
  loginSeedUsers,
  SeedUser,
  TestActor,
} from './helpers/e2e';

// Suite de RÉGRESSION e2e : rejoue à travers la vraie pile HTTP (routing +
// ValidationPipe + guards + ClassSerializerInterceptor global) les routes qui
// renvoyaient un 500, et vérifie qu'elles renvoient désormais un code métier
// propre. C'est la version automatisée de la chasse aux 500 faite au curl.

const BAD_UUID = '00000000-0000-4000-8000-000000000000';

describe('Régressions e2e (500 → code métier)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let users: Record<SeedUser, TestActor>;

  // données résolues dynamiquement (robuste aux ré-seed)
  let addressId: string;
  let alicePackageId: string;
  let marcPackageId: string;
  let advertisementId: string;
  const createdMissionIds: string[] = [];

  const auth = (u: SeedUser) => ({ Authorization: `Bearer ${users[u].token}` });

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DatabaseService);
    users = await loginSeedUsers(app);

    const address = await db.address.findFirst({ select: { id: true } });
    const alicePkg = await db.package.findFirst({
      where: { ownerId: users.alice.id },
      select: { id: true },
    });
    const marcPkg = await db.package.findFirst({
      where: { ownerId: users.marc.id },
      select: { id: true },
    });
    const ad = await db.advertisement.findFirst({ select: { id: true } });

    addressId = address!.id;
    alicePackageId = alicePkg!.id;
    marcPackageId = marcPkg!.id;
    advertisementId = ad!.id;
  });

  afterAll(async () => {
    // Nettoyage des missions jetables créées pendant les tests.
    if (createdMissionIds.length) {
      await db.mission.deleteMany({ where: { id: { in: createdMissionIds } } });
    }
    await app.close();
  });

  const server = () => app.getHttpServer();

  describe('users', () => {
    it('GET /users/me (token forgé) → 200', () => {
      return request(server()).get('/users/me').set(auth('alice')).expect(200);
    });

    it('POST /users/me/saved-addresses/:id (adresse inexistante) → 404 (pas 500)', () => {
      return request(server())
        .post(`/users/me/saved-addresses/${BAD_UUID}`)
        .set(auth('alice'))
        .send({})
        .expect(404);
    });

    it('DELETE /users/me/saved-addresses/:id (jamais sauvegardée) → 204 (idempotent)', () => {
      return request(server())
        .delete(`/users/me/saved-addresses/${BAD_UUID}`)
        .set(auth('alice'))
        .expect(204);
    });

    it('POST /users/verify/email sans token → 400 (pas 500)', () => {
      return request(server())
        .post('/users/verify/email')
        .set(auth('alice'))
        .expect(400);
    });

    it("cycle sauvegarde/suppression d'adresse valide → 201 puis 204", async () => {
      await request(server())
        .post(`/users/me/saved-addresses/${addressId}`)
        .set(auth('alice'))
        .send({ label: 'Test' })
        .expect(201);
      await request(server())
        .delete(`/users/me/saved-addresses/${addressId}`)
        .set(auth('alice'))
        .expect(204);
    });
  });

  describe('missions', () => {
    it('GET /missions/all (admin) → 200 (sérialisation ne crashe plus)', () => {
      return request(server())
        .get('/missions/all')
        .set(auth('admin'))
        .expect(200);
    });

    it('GET /missions/all (non-admin) → 403', () => {
      return request(server())
        .get('/missions/all')
        .set(auth('alice'))
        .expect(403);
    });

    it('POST /missions (annonce inexistante) → 404 (pas 500)', () => {
      return request(server())
        .post('/missions')
        .set(auth('alice'))
        .send({ advertisementId: BAD_UUID })
        .expect(404);
    });

    it('IDOR : POST /missions avec le colis de Marc → 403', () => {
      return request(server())
        .post('/missions')
        .set(auth('alice'))
        .send({ advertisementId, packageIds: [marcPackageId] })
        .expect(403);
    });

    it("POST /missions (colis d'Alice) → 201, puis suppression de colis inexistant → 204", async () => {
      const res = await request(server())
        .post('/missions')
        .set(auth('alice'))
        .send({ advertisementId, packageIds: [alicePackageId] })
        .expect(201);
      const missionId = res.body.id as string;
      createdMissionIds.push(missionId);

      // DELETE d'un colis non lié sur une mission PENDING → idempotent (pas 500)
      await request(server())
        .delete(`/missions/${missionId}/packages/${BAD_UUID}`)
        .set(auth('alice'))
        .expect(204);
    });

    it('mass-assignment : PATCH negotiatedPrice/carrierId ignoré (200, non écrit)', async () => {
      const res = await request(server())
        .post('/missions')
        .set(auth('alice'))
        .send({ advertisementId })
        .expect(201);
      const missionId = res.body.id as string;
      createdMissionIds.push(missionId);

      await request(server())
        .patch(`/missions/${missionId}`)
        .set(auth('alice'))
        .send({ negotiatedPrice: 999, carrierId: users.thomas.id })
        .expect(200);

      // Vérification en base : rien n'a été écrit
      const mission = await db.mission.findUnique({ where: { id: missionId } });
      expect(Number(mission!.negotiatedPrice)).toBe(0);
      expect(mission!.carrierId).toBeNull();
    });
  });

  describe('CSRF (cookie de session cross-site)', () => {
    const FRONT = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const cookie = () => `at=${users.alice.token}`;
    const target = `/users/me/saved-addresses/${BAD_UUID}`;

    it('requête par cookie depuis une origine étrangère → 403 (CSRF bloqué)', () => {
      return request(server())
        .post(target)
        .set('Cookie', cookie())
        .set('Origin', 'https://evil.example')
        .send({})
        .expect(403);
    });

    it('requête par cookie depuis le front → passe le CSRF (404 métier, pas 403)', () => {
      return request(server())
        .post(target)
        .set('Cookie', cookie())
        .set('Origin', FRONT)
        .send({})
        .expect(404);
    });

    it('Bearer (non-ambient) → non bloqué même avec une origine étrangère', () => {
      return request(server())
        .post(target)
        .set(auth('alice'))
        .set('Origin', 'https://evil.example')
        .send({})
        .expect(404);
    });
  });
});
