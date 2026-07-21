import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from 'src/auth/auth.service';
import { createTestApp } from './helpers/e2e';

// Upload de preuve RÉEL (multipart → Cloudinary → média → sérialisation). C'est
// le seul niveau qui couvre la classe de bug qui nous avait surpris : la
// double-sérialisation qui renvoyait `images: []` (ou un 500) au lieu des URLs.
// Ni l'unitaire ni le reste de l'e2e ne testent ce chemin complet.
// Les tests d'upload sont sautés si Cloudinary n'est pas configuré (CI sans creds).

const cloudinaryReady = !!process.env.CLOUDINARY_API_KEY;
const uploadIt = cloudinaryReady ? it : it.skip;

// PNG 1x1 valide (le plus petit fichier image accepté par Cloudinary)
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Upload de preuve (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const uniq = randomUUID().slice(0, 8);
  let shipper: { id: string; token: string };
  let carrier: { id: string; token: string };
  let outsider: { id: string; token: string };
  let advertisementId: string;
  let packageId: string;
  let missionId: string;

  const asShipper = () => ({ Authorization: `Bearer ${shipper.token}` });
  const asCarrier = () => ({ Authorization: `Bearer ${carrier.token}` });
  const asOutsider = () => ({ Authorization: `Bearer ${outsider.token}` });
  const srv = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DatabaseService);
    const auth = app.get(AuthService);
    const addresses = await db.address.findMany({
      take: 2,
      select: { id: true },
    });

    const mk = async (role: 'SHIPPER' | 'CARRIER', label: string) => {
      const u = await db.user.create({
        data: {
          email: `e2e-proofup-${label}-${uniq}@test.local`,
          firstName: 'E2E',
          lastName: label,
          role,
          emailVerifiedAt: new Date(),
          ...(role === 'CARRIER' ? { idCardVerifiedAt: new Date() } : {}),
        },
      });
      return {
        id: u.id,
        token: auth.signAccessTokenJwt({ id: u.id as never }),
      };
    };
    shipper = await mk('SHIPPER', 'shipper');
    carrier = await mk('CARRIER', 'carrier');
    outsider = await mk('SHIPPER', 'outsider');

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

    const pkg = await db.package.create({
      data: { name: 'Colis E2E', weight: 3, ownerId: shipper.id },
    });
    packageId = pkg.id;

    const mission = await db.mission.create({
      data: {
        advertisementId: ad.id,
        shipperId: shipper.id,
        carrierId: carrier.id,
        status: 'ACCEPTED',
        negotiatedPrice: 100,
        packages: { create: { packageId: pkg.id } },
      },
    });
    missionId = mission.id;
  });

  afterAll(async () => {
    try {
      // Supprime médias + liens de preuve créés par l'upload (fichiers Cloudinary
      // orphelins tolérés dans un test), puis le reste.
      const proofs = await db.missionProof.findMany({
        where: { missionId },
        select: { id: true },
      });
      const proofIds = proofs.map((p) => p.id);
      const links = await db.missionProofImage.findMany({
        where: { proofId: { in: proofIds } },
        select: { imageId: true },
      });
      await db.missionProofImage.deleteMany({
        where: { proofId: { in: proofIds } },
      });
      await db.media.deleteMany({
        where: { id: { in: links.map((l) => l.imageId) } },
      });
      await db.missionProof.deleteMany({ where: { missionId } });
      await db.missionPackage.deleteMany({ where: { missionId } });
      await db.mission.deleteMany({ where: { id: missionId } });
      await db.advertisement.deleteMany({ where: { id: advertisementId } });
      await db.package.deleteMany({ where: { id: packageId } });
      await db.user.deleteMany({
        where: { id: { in: [shipper.id, carrier.id, outsider.id] } },
      });
    } catch {
      // best-effort
    }
    await app.close();
  });

  it('corps JSON (pas de multipart) → 400 "At least one image"', () => {
    return request(srv())
      .post(`/missions/${missionId}/proof/pickup/images`)
      .set(asShipper())
      .set('Content-Type', 'application/json')
      .send({})
      .expect(400);
  });

  it('un non-participant ne peut pas uploader → 403', () => {
    return request(srv())
      .post(`/missions/${missionId}/proof/pickup/images`)
      .set(asOutsider())
      .attach('images', PNG_1x1, {
        filename: 't.png',
        contentType: 'image/png',
      })
      .expect(403);
  });

  uploadIt(
    'upload multipart réel → 201 et la réponse contient les URLs (pas [] ni 500)',
    async () => {
      const res = await request(srv())
        .post(`/missions/${missionId}/proof/pickup/images`)
        .set(asShipper())
        .attach('images', PNG_1x1, {
          filename: 't.png',
          contentType: 'image/png',
        })
        .expect(201);

      // Le cœur du test : la double-sérialisation ne vide plus le tableau.
      expect(Array.isArray(res.body.images)).toBe(true);
      expect(res.body.images.length).toBeGreaterThanOrEqual(1);
      expect(res.body.images[0]).toMatch(/^https?:\/\//);
    },
  );

  uploadIt(
    'le détail de mission expose aussi les photos de preuve (MissionEntity.proofs)',
    async () => {
      const res = await request(srv())
        .get(`/missions/${missionId}`)
        .set(asCarrier())
        .expect(200);
      expect(res.body.proofs?.PICKUP?.length).toBeGreaterThanOrEqual(1);
      expect(res.body.proofs.PICKUP[0]).toMatch(/^https?:\/\//);
    },
  );

  if (!cloudinaryReady) {
    it('(uploads Cloudinary sautés — CLOUDINARY_API_KEY absent)', () => {
      expect(cloudinaryReady).toBe(false);
    });
  }
});
