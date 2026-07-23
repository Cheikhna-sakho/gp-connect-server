import { ApiBadRequestResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IdentityService } from './identity.service';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { SkipCsrf } from 'src/common/decorators/skip-csrf.decorator';
import { UUID } from 'crypto';
import { Request } from 'express';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { IdentityStatusEntity } from './entities/identity-status.entity';
import { IdentitySessionEntity } from './entities/identity-session.entity';

@ApiTags('identity')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @ApiAuth()
  @Get('status')
  @Serialize(IdentityStatusEntity)
  getStatus(@GetUserId() userId: UUID) {
    return this.identityService.getStatus(userId);
  }

  @ApiAuth()
  @ApiBadRequestResponse({ description: 'Identité déjà vérifiée' })
  @Post('start')
  @Serialize(IdentitySessionEntity)
  start(@GetUserId() userId: UUID) {
    return this.identityService.createVerificationSession(userId);
  }

  @Public()
  @SkipThrottle()
  @SkipCsrf()
  @ApiBadRequestResponse({
    description: 'Signature Stripe invalide ou secret non configuré',
  })
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.identityService.handleWebhook(req.rawBody, signature);
  }
}
