import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/e2e';

// Smoke e2e : l'app complète boote et le guard d'auth global est bien actif
// (une route protégée sans session → 401). Le reste du flux est couvert par
// regression.e2e-spec.ts et les suites e2e par domaine.

describe('App (e2e) — smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('boote et protège les routes : GET /users/me sans auth → 401', () => {
    return request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('GET /advertisements est public → 200', () => {
    return request(app.getHttpServer()).get('/advertisements').expect(200);
  });
});
