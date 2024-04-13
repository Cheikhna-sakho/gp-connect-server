import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AdvertisementsModule } from './advertisements/advertisements.module';

@Module({
  imports: [DatabaseModule, UsersModule, AdvertisementsModule],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
