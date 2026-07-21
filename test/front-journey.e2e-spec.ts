// LE PARCOURS DU FRONT, REJOUÉ PUREMENT CÔTÉ API.
//
// Les autres suites e2e s'authentifient en Bearer (JWT forgé) — pratique, mais
// ça SAUTE le chemin que le navigateur emprunte réellement : cookies httpOnly
// + CsrfGuard + refresh silencieux. Cette suite rejoue, écran par écran, les
// appels EXACTS que le client Next fait en naviguant (mêmes endpoints, mêmes
// query params, même séquence), et fige la FORME des réponses que l'UI
// consomme (ex. `departure.city.name` sur les cartes d'annonces). Objectif :
// qu'une régression visible « en naviguant » soit attrapée ici d'abord.
//
// Sources côté client : src/api/*.api.ts, src/contexts/AppContext.tsx (getMe
// au montage), src/config/axiosConfig.ts (401 → refresh → rejeu).

// OTP déterministe pour jouer le vrai login (voir src/common/utils/otp.util.ts
// — ignoré en production). Défini AVANT le boot de l'app.
process.env.E2E_FIXED_OTP = process.env.E2E_FIXED_OTP ?? '123456';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DatabaseService } from 'src/database/database.service';
import { createTestApp } from './helpers/e2e';

const FIXED_OTP = process.env.E2E_FIXED_OTP;
const ALICE = 'alice@gpconnect.test'; // SHIPPER seed

describe('Parcours front simulé côté API (cookies + CSRF)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  /** Le « navigateur » : un agent supertest qui conserve les cookies. */
  let browser: TestAgent;
  /** Origine légitime du front — celle que CsrfGuard exige. */
  let ORIGIN: string;
  let addressId: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DatabaseService);
    browser = request.agent(server());
    ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    const address = await db.address.findFirst({ select: { id: true } });
    addressId = address!.id;
  });

  afterAll(async () => {
    // Fixture éventuellement laissée par le test saved-addresses.
    const alice = await db.user.findFirst({ where: { email: ALICE } });
    if (alice) {
      await db.savedAddress.deleteMany({ where: { userId: alice.id } });
    }
    await app.close();
  });

  // ─── Écran /announces, anonyme (vitrine) ─────────────────────────────────

  describe('vitrine anonyme (/announces)', () => {
    it('bootstrap de session anonyme : GET /users/me → 401, POST /auth/refresh → 401 (jamais 500)', async () => {
      // Ces deux appels partent à CHAQUE chargement de page anonyme
      // (AppContext.getMe puis tentative de refresh de l’intercepteur).
      await request(server()).get('/users/me').expect(401);
      await request(server()).post('/auth/refresh').expect(401);
    });

    it('GET /advertisements?type=DELIVERY&page=1 → 200 + la forme exacte que les cartes consomment', async () => {
      const { body } = await request(server())
        .get('/advertisements')
        .query({ type: 'DELIVERY', page: 1 })
        .expect(200);

      // Pagination lue par useAccumulatedAnnounces (hasMore = page < pages).
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(typeof body.meta?.page).toBe('number');
      expect(typeof body.meta?.pages).toBe('number');

      // Champs lus par AnnounceCardDesktop — si l’un casse (sérialisation,
      // include manquant), le front affiche des cartes vides/undefined.
      for (const ad of body.data) {
        expect(typeof ad.id).toBe('string');
        expect(typeof ad.author?.fullName).toBe('string');
        expect(ad.author?.trust?.level).toBeDefined();
        expect(typeof ad.departure?.city?.name).toBe('string');
        expect(typeof ad.destination?.city?.name).toBe('string');
        expect(Number.isFinite(Number(ad.price))).toBe(true);
        expect(Number.isFinite(Number(ad.maxWeight))).toBe(true);
        expect(Number.isFinite(Number(ad.cumulatedWeight))).toBe(true);
        // Anti-fuite : une annonce publique ne doit exposer ni email ni téléphone.
        expect(ad.author?.email).toBeUndefined();
        expect(ad.author?.phone).toBeUndefined();
      }
    });

    it('GET /advertisements/:id (détail) → 200 + auteur/villes présents', async () => {
      const list = await request(server())
        .get('/advertisements')
        .query({ type: 'DELIVERY', page: 1 })
        .expect(200);
      const id = list.body.data[0].id;

      const { body } = await request(server())
        .get(`/advertisements/${id}`)
        .expect(200);
      expect(body.id).toBe(id);
      expect(typeof body.author?.fullName).toBe('string');
      expect(typeof body.departure?.city?.name).toBe('string');
      expect(body.author?.email).toBeUndefined();
    });
  });

  // ─── Écran /auth/login : le vrai flux OTP, cookies compris ───────────────

  describe('login navigateur (OTP + cookies httpOnly)', () => {
    it('POST /auth/login (compte inconnu) → 401 (le front affiche « Aucun compte associé »)', async () => {
      await request(server())
        .post('/auth/login')
        .send({ identifier: 'inconnu@nulle-part.test' })
        .expect(401);
    });

    it('POST /auth/login (compte seed) → 2xx, puis mauvais code OTP → 401', async () => {
      const login = await browser
        .post('/auth/login')
        .send({ identifier: ALICE });
      expect(login.status).toBeLessThan(400);

      await browser
        .post('/auth/otp')
        .send({ identifier: ALICE, code: '000000', type: 'EMAIL' })
        .expect(401);
    });

    it('POST /auth/otp (bon code) → user sérialisé + cookies at/rt httpOnly', async () => {
      const res = await browser
        .post('/auth/otp')
        .send({ identifier: ALICE, code: FIXED_OTP, type: 'EMAIL' });
      expect(res.status).toBeLessThan(400);

      // Le corps est ce que le front stocke (authServices.login(data)).
      expect(res.body.firstName).toBe('Alice');
      expect(res.body.role).toBe('SHIPPER');

      // Les cookies de session doivent être httpOnly (inaccessibles au JS).
      const setCookies = res.get('Set-Cookie') ?? [];
      const at = setCookies.find((c: string) => c.startsWith('at='));
      const rt = setCookies.find((c: string) => c.startsWith('rt='));
      expect(at).toMatch(/HttpOnly/i);
      expect(rt).toMatch(/HttpOnly/i);
    });

    it('GET /users/me avec cookie (bootstrap AppContext) → 200', async () => {
      const { body } = await browser.get('/users/me').expect(200);
      expect(body.firstName).toBe('Alice');
    });

    it('POST /auth/refresh avec cookie rt (intercepteur axios) → 204 + nouveau at', async () => {
      const res = await browser
        .post('/auth/refresh')
        .set('Origin', ORIGIN)
        .expect(204);
      const setCookies = res.get('Set-Cookie') ?? [];
      expect(setCookies.some((c: string) => c.startsWith('at='))).toBe(true);
    });
  });

  // ─── CSRF : la protection du chemin cookie (celle que Bearer ne teste pas) ─

  describe('CSRF sur le chemin cookie', () => {
    it('mutation en cookie SANS Origin → 403 (formulaire cross-site simulé)', async () => {
      await browser.post(`/users/me/saved-addresses/${addressId}`).expect(403);
    });

    it('mutation en cookie avec Origin d’un site tiers → 403', async () => {
      await browser
        .post(`/users/me/saved-addresses/${addressId}`)
        .set('Origin', 'https://evil.example')
        .expect(403);
    });

    it('mutation en cookie avec l’Origin du front → acceptée (comme le navigateur)', async () => {
      const res = await browser
        .post(`/users/me/saved-addresses/${addressId}`)
        .set('Origin', ORIGIN);
      expect(res.status).toBeLessThan(400);

      await browser
        .delete(`/users/me/saved-addresses/${addressId}`)
        .set('Origin', ORIGIN)
        .expect(204);
    });
  });

  // ─── Les écrans authentifiés : chaque GET que la navigation déclenche ─────

  describe('écrans authentifiés (cookie, comme le navigateur)', () => {
    it('home connecté : GET /missions (strip missions actives) → 200', async () => {
      const { body } = await browser.get('/missions').expect(200);
      // Le hook useMissions lit `payload.data ?? payload` (tableau ou paginé).
      const missions = Array.isArray(body) ? body : body.data;
      expect(Array.isArray(missions)).toBe(true);
    });

    it('dashboard : GET /advertisements/mine → 200 (paginé)', async () => {
      const { body } = await browser.get('/advertisements/mine').expect(200);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('dashboard : GET /packages → 200 et GET /users/me/stats → 200', async () => {
      await browser.get('/packages').expect(200);
      await browser.get('/users/me/stats').expect(200);
    });

    it('messages : GET /conversations?page=1&limit=10 → 200', async () => {
      await browser
        .get('/conversations')
        .query({ page: 1, limit: 10 })
        .expect(200);
    });

    it('settings : préférences, adresses sauvegardées, statut KYC → 200', async () => {
      await browser.get('/users/me/preferences').expect(200);
      await browser.get('/users/me/saved-addresses').expect(200);
      await browser.get('/identity/status').expect(200);
    });
  });

  // ─── Logout : fin du parcours ─────────────────────────────────────────────

  describe('logout navigateur', () => {
    it('POST /auth/logout → 204 + cookies purgés, la session est bien morte', async () => {
      await browser.post('/auth/logout').set('Origin', ORIGIN).expect(204);
      // Le clear a fonctionné si l’agent (qui rejoue ses cookies) est déconnecté.
      await browser.get('/users/me').expect(401);
    });
  });
});
