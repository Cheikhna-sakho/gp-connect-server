import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { envConfig } from 'src/common/constants/env.const';
import helmet from 'helmet';
import { ClassSerializerInterceptor } from '@nestjs/common';
// import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors();
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  console.log({ db_host: process.env.HOST });
  await app.listen(envConfig.PORT);
}
bootstrap();
