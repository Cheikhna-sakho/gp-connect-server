import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ClassConstructor, plainToClass } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export class SerializeInterceptor<T> implements NestInterceptor {
  constructor(private dto: ClassConstructor<T>) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<T> {
    return next.handle().pipe(
      map((data: T) => {
        return plainToClass(this.dto, data, {
          excludeExtraneousValues: true,
          exposeUnsetFields: false,
        });
      }),
    );
  }
}
