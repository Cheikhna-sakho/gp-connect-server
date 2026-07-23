import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

/**
 * Route (ou contrôleur) derrière la session cookie : référence le schéma
 * d'auth `access_token` dans Swagger et documente le 401 systématique.
 * Le 429 (throttler global 100 req/min) n'est pas répété partout — seuls
 * les plafonds dédiés (auth, OTP, messages) sont documentés sur place.
 */
export const ApiAuth = () =>
  applyDecorators(
    ApiCookieAuth('access_token'),
    ApiUnauthorizedResponse({
      description: 'Session absente ou expirée (cookie access_token)',
    }),
  );
