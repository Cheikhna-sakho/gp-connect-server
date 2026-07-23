import { applyDecorators, Type, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ClassConstructor } from 'class-transformer';
import { SerializeInterceptor } from '../interceptors';

/**
 * Sérialise la réponse à travers l'entité ET la déclare comme schéma de
 * réponse Swagger — une seule source de vérité : ce que la doc montre est
 * exactement ce que l'interceptor laisse sortir. Pour les routes qui
 * renvoient une liste, le schéma documente l'élément (le type d'item).
 */
export function Serialize<T>(dto: ClassConstructor<T>) {
  return applyDecorators(
    UseInterceptors(new SerializeInterceptor(dto)),
    ApiOkResponse({ type: dto as Type<unknown> }),
  );
}
