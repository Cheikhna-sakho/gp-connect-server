import { Global, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserVerificationService } from './user-verification.service';
import { DatabaseModule } from 'src/database/database.module';
import { MediasModule } from 'src/medias/medias.module';
import { EmailModule } from 'src/email/email.module';
import { PhoneModule } from 'src/phone/phone.module';
import { IdentityModule } from 'src/identity/identity.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    MediasModule,
    EmailModule,
    PhoneModule,
    IdentityModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserVerificationService],
  exports: [UsersService, UserVerificationService],
})
export class UsersModule {}
