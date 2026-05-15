import { UseInterceptors } from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';
import { SerializePageInterceptor } from '../interceptors/serialize-page.interceptor';

export function SerializePage<T>(dto: ClassConstructor<T>) {
  return UseInterceptors(new SerializePageInterceptor(dto));
}
