import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import helmet from 'helmet';
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
    req.path.startsWith('/admin')
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

  const logger = new Logger('Bootstrap');
  await app.listen(PORT);
  logger.log(`Server running on port ${PORT}`);
}
bootstrap();
