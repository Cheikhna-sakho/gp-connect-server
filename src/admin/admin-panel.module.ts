import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AdminModule } from '@adminjs/nestjs';
import type { ActionContext, ActionRequest } from 'adminjs';
import AdminJS from 'adminjs';
import { Database, Resource } from '@adminjs/prisma';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { DisputesModule } from 'src/disputes/disputes.module';
import { DisputesService } from 'src/disputes/disputes.service';

AdminJS.registerAdapter({ Database, Resource });

// @adminjs/prisma v3 lit `client._baseDmmf` (interne Prisma 4, supprimé en
// Prisma 5) — mais son Resource ne consomme que { name, fields } : on lui
// passe les modèles depuis le DMMF public, compatible Prisma 5.
const model = (name: string) =>
  Prisma.dmmf.datamodel.models.find((m) => m.name === name);

// Ressource en consultation seule.
const readOnly = {
  new: { isAccessible: false },
  edit: { isAccessible: false },
  delete: { isAccessible: false },
  bulkDelete: { isAccessible: false },
};

/**
 * Back-office AdminJS sur /admin — consultation (users, annonces, missions,
 * transactions, signalements, blocages, notes) + résolution des litiges via
 * le VRAI DisputesService.resolve (effets de bord préservés : statut mission,
 * annulation des transactions, broadcast temps réel).
 *
 * Auth : email d'un user ADMIN en base + ADMIN_PANEL_PASSWORD (env).
 * Sans cette variable, le module ne s'enregistre pas (aucun impact dev/test).
 */
@Module({})
export class AdminPanelModule {
  static forRoot(): DynamicModule[] {
    if (!process.env.ADMIN_PANEL_PASSWORD) return [];

    return [
      AdminModule.createAdminAsync({
        imports: [DatabaseModule, DisputesModule],
        inject: [DatabaseService, DisputesService, ConfigService],
        useFactory: (
          db: DatabaseService,
          disputes: DisputesService,
          config: ConfigService,
        ) => {
          // Shim des internes Prisma 4 que l'adaptateur consomme encore
          // (supprimés du client en Prisma 5) — reconstruits depuis le DMMF
          // public : mêmes formes (modelMap, enums avec values[].name).
          const internals = db as unknown as {
            _baseDmmf?: unknown;
            _engineConfig?: { activeProvider?: string };
          };
          internals._baseDmmf ??= {
            modelMap: Object.fromEntries(
              Prisma.dmmf.datamodel.models.map((m) => [m.name, m]),
            ),
            datamodelEnumMap: Object.fromEntries(
              Prisma.dmmf.datamodel.enums.map((e) => [e.name, e]),
            ),
          };
          internals._engineConfig ??= { activeProvider: 'postgresql' };

          const resolveAction = (outcome: 'COMPLETED' | 'CANCELLED') => ({
            actionType: 'record' as const,
            icon: outcome === 'COMPLETED' ? 'Checkmark' : 'Close',
            guard:
              outcome === 'COMPLETED'
                ? 'Résoudre le litige et terminer la mission ?'
                : 'Résoudre le litige et annuler la mission ?',
            component: false as const,
            handler: async (
              _req: ActionRequest,
              _res: unknown,
              context: ActionContext,
            ) => {
              const { record, currentAdmin } = context;
              try {
                await disputes.resolve(
                  String(record?.params.id),
                  String(currentAdmin?.id),
                  {
                    resolution:
                      (record?.params.resolution as string) ||
                      "Litige traité par l'équipe GPConnect.",
                    missionOutcome: outcome,
                  },
                );
                return {
                  record: record?.toJSON(currentAdmin),
                  notice: {
                    message: `Litige résolu — mission ${outcome === 'COMPLETED' ? 'terminée' : 'annulée'}.`,
                    type: 'success' as const,
                  },
                  redirectUrl: '/admin/resources/MissionDispute',
                };
              } catch (err) {
                return {
                  record: record?.toJSON(currentAdmin),
                  notice: {
                    message: `Échec de la résolution : ${(err as Error).message}`,
                    type: 'error' as const,
                  },
                };
              }
            },
          });

          return {
            adminJsOptions: {
              rootPath: '/admin',
              branding: {
                companyName: 'GPConnect — Back-office',
                withMadeWithLove: false,
              },
              resources: [
                {
                  resource: { model: model('MissionDispute'), client: db },
                  options: {
                    navigation: { name: 'Trust & safety' },
                    // Renseigner `resolution` via Edit, puis déclencher
                    // l'action de résolution (qui passe par le service).
                    editProperties: ['resolution'],
                    actions: {
                      new: { isAccessible: false },
                      delete: { isAccessible: false },
                      bulkDelete: { isAccessible: false },
                      resolveCompleted: resolveAction('COMPLETED'),
                      resolveCancelled: resolveAction('CANCELLED'),
                    },
                  },
                },
                {
                  resource: { model: model('Report'), client: db },
                  options: {
                    navigation: { name: 'Trust & safety' },
                    editProperties: ['status'],
                    actions: {
                      new: { isAccessible: false },
                      delete: { isAccessible: false },
                      bulkDelete: { isAccessible: false },
                    },
                  },
                },
                {
                  resource: { model: model('UserBlock'), client: db },
                  options: {
                    navigation: { name: 'Trust & safety' },
                    actions: readOnly,
                  },
                },
                {
                  resource: { model: model('User'), client: db },
                  options: {
                    navigation: { name: 'Données' },
                    actions: readOnly,
                  },
                },
                {
                  resource: { model: model('Advertisement'), client: db },
                  options: {
                    navigation: { name: 'Données' },
                    actions: readOnly,
                  },
                },
                {
                  resource: { model: model('Mission'), client: db },
                  options: {
                    navigation: { name: 'Données' },
                    actions: readOnly,
                  },
                },
                {
                  resource: { model: model('Transaction'), client: db },
                  options: {
                    navigation: { name: 'Données' },
                    actions: readOnly,
                  },
                },
                {
                  resource: { model: model('MissionRating'), client: db },
                  options: {
                    navigation: { name: 'Données' },
                    actions: readOnly,
                  },
                },
              ],
            },
            auth: {
              // Pas de mot de passe utilisateur dans l'app (login OTP) : le
              // panel a le sien — email d'un ADMIN en base + password env.
              authenticate: async (email: string, password: string) => {
                if (password !== config.get('ADMIN_PANEL_PASSWORD'))
                  return null;
                const admin = await db.user.findFirst({
                  where: { email, role: 'ADMIN' },
                  select: { id: true, email: true },
                });
                return admin ? { id: admin.id, email: admin.email } : null;
              },
              cookieName: 'gp_admin',
              cookiePassword:
                config.get('ADMIN_COOKIE_SECRET') ??
                config.get('ADMIN_PANEL_PASSWORD'),
            },
            sessionOptions: {
              resave: false,
              saveUninitialized: false,
              secret:
                config.get('ADMIN_COOKIE_SECRET') ??
                config.get('ADMIN_PANEL_PASSWORD'),
            },
          };
        },
      }),
    ];
  }
}
