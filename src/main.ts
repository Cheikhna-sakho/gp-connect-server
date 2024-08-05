import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envConfig } from 'src/common/constants/env.const';
import helmet from 'helmet';
// import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors();
  await app.listen(envConfig.PORT);
}
bootstrap();
