import { Global, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from 'src/database/database.module';
import { MediasModule } from 'src/medias/medias.module';
import { EmailModule } from 'src/email/email.module';
import { PhoneModule } from 'src/phone/phone.module';

@Global()
@Module({
  imports: [DatabaseModule, MediasModule, EmailModule, PhoneModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
