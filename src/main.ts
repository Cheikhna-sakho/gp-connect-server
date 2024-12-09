import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { envConfig } from 'src/common/constants/env.const';
import helmet from 'helmet';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
// import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: '*' });
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );
  console.log({ db_host: process.env.HOST, port: envConfig.PORT });
  await app.listen(3000);
}
bootstrap();
