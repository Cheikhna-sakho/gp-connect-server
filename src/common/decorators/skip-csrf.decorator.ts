import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

// À poser sur les routes server-to-server (ex. webhook Stripe) qui n'ont pas de
// notion d'origine navigateur et sont protégées autrement (signature).
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
