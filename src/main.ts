import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

const PORT = process.env.PORT ?? 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useWebSocketAdapter(new IoAdapter(app));
  app.use(cookieParser());
  app.use(helmet());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(PORT);
}
bootstrap();
