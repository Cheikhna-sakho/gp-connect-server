import { PartialType } from '@nestjs/mapped-types';
import { CreateMessageDto } from './message.dto';

export class MessageUpdateDto extends PartialType(CreateMessageDto) {}
