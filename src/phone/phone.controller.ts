import { Controller } from '@nestjs/common';
import { PhoneService } from './phone.service';
@Controller('phone')
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}
}
