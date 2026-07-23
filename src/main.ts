import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const PORT = process.env.PORT ?? 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useWebSocketAdapter(new IoAdapter(app));
  app.use(cookieParser());
  // AdminJS (SPA servie par le back) repose sur des scripts inline
  // (REDUX_STATE, bundles de composants) : la CSP stricte de l'API les
  // bloque → écran blanc après login. On garde helmet partout, mais sans
  // CSP sur /admin — le panel est env-gaté et derrière sa propre auth ;
  // l'API, elle, ne sert pas de HTML, sa CSP stricte ne coûte rien.
  const strictHelmet = helmet();
  const adminHelmet = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/admin') || req.path.startsWith('/docs')
      ? adminHelmet(req, res, next)
      : strictHelmet(req, res, next),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Documentation API (Swagger) sur /docs — les schémas des DTOs/entités
  // sont générés par le plugin CLI @nestjs/swagger (nest-cli.json) à partir
  // des types + class-validator ; les contrôleurs portent tags, auth et
  // codes d'erreur. La CSP stricte bloque les scripts inline de Swagger UI :
  // /docs passe par la même exemption que /admin (cf. middleware helmet).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GPConnect API')
    .setDescription(
      'API de la marketplace de livraison collaborative GPConnect — ' +
        'annonces, négociation (conversations/offres/RDV), missions avec ' +
        'preuves OTP, transactions, confiance & sécurité. ' +
        'Auth par cookies httpOnly (access/refresh) posés par /auth : dans ' +
        'Swagger UI, se connecter via POST /auth/login puis /auth/otp — le ' +
        'navigateur porte les cookies automatiquement.',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'GPConnect API — documentation',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
  });

  const logger = new Logger('Bootstrap');
  await app.listen(PORT);
  logger.log(`Server running on port ${PORT}`);
}
bootstrap();
