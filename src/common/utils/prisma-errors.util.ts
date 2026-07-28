/**
 * Détection des erreurs Prisma connues — l'unique fuite Prisma tolérée dans
 * les services : la sémantique (« contrainte d'unicité violée », « ligne
 * introuvable ») est nommée ici une fois pour toutes au lieu des
 * comparaisons de codes dispersées.
 *
 * Détection par le code (pas instanceof) : équivalent en pratique, et
 * compatible avec les erreurs simulées des tests.
 */
const prismaCode = (e: unknown): string | undefined =>
  (e as { code?: string } | null | undefined)?.code;

/** P2002 — violation de contrainte d'unicité (→ 409 en général). */
export const isUniqueViolation = (e: unknown): boolean =>
  prismaCode(e) === 'P2002';

/** P2025 — ligne introuvable pour update/delete (→ 404 en général). */
export const isRecordNotFound = (e: unknown): boolean =>
  prismaCode(e) === 'P2025';
