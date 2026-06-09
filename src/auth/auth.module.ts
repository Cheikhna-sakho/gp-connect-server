import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { DatabaseModule } from 'src/database/database.module';
import { AccessTokenStrategy } from './strategies/accessToken.strategy';
import { RefreshTokenStrategy } from './strategies/refreshToken.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

// On n'instancie GoogleStrategy que si Google est configuré : sans clientID,
// passport jette à la construction et ferait tomber tout le boot de l'API.
// Variable manquante -> login Google désactivé, le reste de l'app démarre.
const googleStrategyProvider = {
  provide: GoogleStrategy,
  useFactory: (config: ConfigService) => {
    if (!config.get('GOOGLE_CLIENT_ID')) {
      new Logger('AuthModule').warn(
        'GOOGLE_CLIENT_ID absent — login Google désactivé.',
      );
      return null;
    }
    return new GoogleStrategy(config);
  },
  inject: [ConfigService],
};

@Module({
  imports: [UsersModule, DatabaseModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    googleStrategyProvider,
  ],
})
export class AuthModule {}
