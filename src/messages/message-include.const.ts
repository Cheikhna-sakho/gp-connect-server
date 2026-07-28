// Includes Prisma d'un message (offre + rendez-vous). Constante partagée :
// importée par MessagesService et ConversationsService sans créer de
// dépendance entre leurs modules (c'est elle qui motivait l'ancien
// forwardRef conversations -> messages, inutile pour un simple import de
// valeur).
export const MESSAGE_INCLUDE = { offer: true, appointment: true } as const;
