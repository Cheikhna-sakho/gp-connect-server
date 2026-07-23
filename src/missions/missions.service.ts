import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdvertisementStatus, MissionStatus, Prisma } from '@prisma/client';
import { UUID } from 'crypto';
import { DatabaseService } from 'src/database/database.service';
import { CreateMissionDto } from './dtos/create-mission.dto';
import { MissionQuery } from './dtos/mission-query.dto';
import {
  MISSION_DEFAULT_INCLUDE,
  MISSION_DETAIL_INCLUDE,
} from './entities/mission.entity';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';
import { UpdateMissionDto } from './dtos/update-mission.dto';
// Vue admin complète. `packages` doit inclure le `package` imbriqué : le getter
// `cumulatedWeight` de MissionEntity lit `packages[].package.weight` et crasherait
// (500) sur un simple `packages: true` (lignes de jointure sans le package).
const MISSION_WITH_ALL_FIELDS = {
  advertisement: true,
  transaction: true,
  packages: { select: { package: true } },
  shipper: true,
  carrier: true,
} satisfies Prisma.MissionInclude;
@Injectable()
export class MissionsService {
  private missions: DatabaseService['mission'];
  private missionPackages: DatabaseService['missionPackage'];
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.missions = this.databaseService.mission;
    this.missionPackages = this.databaseService.missionPackage;
  }
  async findAll(where?: Prisma.MissionWhereInput) {
    return this.missions.findMany({ where, include: MISSION_WITH_ALL_FIELDS });
  }
  async find(where: Prisma.MissionWhereInput) {
    return this.missions.findMany({ where });
  }
  async findByUser(userId: UUID, { page, limit, ...where }: MissionQuery) {
    const safeLimit = Math.min(limit ?? 20, 50);
    const skip = ((page ?? 1) - 1) * safeLimit;

    const baseWhere = {
      AND: [
        {
          OR: [{ shipperId: userId }, { carrierId: userId }],
          status: { not: 'PENDING' as const },
        },
        where,
      ],
    };

    const [data, total] = await Promise.all([
      this.missions.findMany({
        where: baseWhere,
        include: { ...MISSION_DEFAULT_INCLUDE, shipper: true, carrier: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.missions.count({ where: baseWhere }),
    ]);

    return {
      data,
      meta: {
        total,
        page: page ?? 1,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit),
      },
    };
  }
  async findOne(id: UUID) {
    return this.missions.findFirst({ where: { id } });
  }

  async findOneForUser(id: string, userId: string) {
    return this.missions.findFirst({
      where: { id, OR: [{ shipperId: userId }, { carrierId: userId }] },
      include: {
        ...MISSION_DETAIL_INCLUDE,
        shipper: { include: USER_DEFAULT_INCLUDE },
        carrier: { include: USER_DEFAULT_INCLUDE },
      },
    });
  }
  async create(data: CreateMissionDto) {
    const { advertisementId, packageIds, shipperId } = data;
    // L'annonce doit exister (sinon `connect` lève P2025 → 500).
    const advertisement = await this.databaseService.advertisement.findUnique({
      where: { id: advertisementId },
      select: { id: true },
    });
    if (!advertisement) throw new NotFoundException('Advertisement not found');
    // Les colis rattachés doivent appartenir au shipper (sinon IDOR : lier les
    // colis d'autrui à sa mission, les lire et les verrouiller). Miroir d'addPackages.
    if (packageIds?.length) {
      const owned = await this.verifyPackagesOwnership(packageIds, shipperId);
      if (!owned) {
        throw new ForbiddenException(
          'One or more packages do not belong to you',
        );
      }
    }
    const joinFields = {
      packages:
        undefined as Prisma.MissionPackageCreateNestedManyWithoutMissionInput,
    };
    if (packageIds?.length) {
      joinFields.packages = {
        createMany: { data: packageIds.map((packageId) => ({ packageId })) },
      };
    }
    return this.missions.create({
      data: {
        advertisement: { connect: { id: advertisementId } },
        shipper: { connect: { id: shipperId } },
        ...joinFields,
      },
    });
  }

  async addPackages(missionId: string, packageIds: string[]) {
    const existingPackages = await this.missionPackages.findMany({
      where: { missionId },
      select: { packageId: true },
    });
    const existingIds = new Set(existingPackages.map((p) => p.packageId));
    return this.missionPackages.createMany({
      data: packageIds
        .filter((p) => !existingIds.has(p))
        .map((packageId) => ({ packageId, missionId })),
    });
  }

  async removePackage(missionId: string, packageId: string) {
    // Idempotent : retirer un colis non lié ne doit pas 500
    // (Prisma.delete lève P2025 si la ligne n'existe pas).
    await this.missionPackages.deleteMany({
      where: { missionId, packageId },
    });
  }

  async update(id: UUID, data: UpdateMissionDto) {
    if (data.status) {
      const current = await this.validateStatusTransition(
        id as string,
        data.status as MissionStatus,
      );

      // Verrou optimiste : la matrice de transition n'a de sens que si le
      // write porte le statut de départ — sinon deux transitions concurrentes
      // valident chacune sur l'ancien statut.
      if (current) {
        const { count } = await this.missions.updateMany({
          where: { id, status: current },
          data,
        });
        if (count === 0) {
          throw new BadRequestException(
            'Mission status changed concurrently — retry',
          );
        }
        const mission = await this.missions.findUniqueOrThrow({
          where: { id },
        });
        await this.applyStatusSideEffects({
          id: mission.id,
          advertisementId: mission.advertisementId,
          status: mission.status,
        });
        return mission;
      }
    }

    return this.missions.update({ where: { id }, data });
  }

  /**
   * Effets de bord d'un changement de statut de mission, partagés entre la
   * transition standard (update) et la résolution de litige (DisputesService) :
   * MAJ du statut de l'annonce, annulation des transactions en attente,
   * archivage des conversations, et broadcast temps réel. À appeler APRÈS avoir
   * persisté le nouveau statut de la mission.
   */
  async applyStatusSideEffects(mission: {
    id: string;
    advertisementId: string;
    status: MissionStatus;
  }) {
    const adStatus: AdvertisementStatus | null =
      mission.status === 'ACCEPTED' || mission.status === 'IN_TRANSIT'
        ? AdvertisementStatus.IN_PROGRESS
        : mission.status === 'COMPLETED'
          ? AdvertisementStatus.COMPLETED
          : mission.status === 'CANCELLED'
            ? AdvertisementStatus.OPEN
            : null;

    // Un seul $transaction : une panne au milieu ne doit pas laisser une
    // mission CANCELLED avec une annonce encore IN_PROGRESS ou une
    // transaction encore PENDING.
    const writes = [];
    if (adStatus) {
      writes.push(
        this.databaseService.advertisement.update({
          where: { id: mission.advertisementId },
          data: { status: adStatus },
        }),
      );
    }
    if (mission.status === 'CANCELLED') {
      writes.push(
        this.databaseService.transaction.updateMany({
          where: { missionId: mission.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        }),
      );
    }
    // Auto-archive conversations when mission ends
    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
      writes.push(
        this.databaseService.conversation.updateMany({
          where: { missionId: mission.id },
          data: { status: 'ARCHIVED' },
        }),
      );
    }
    if (writes.length) {
      await this.databaseService.$transaction(writes);
    }

    // Broadcast mission status change to all linked conversation rooms
    const conversations = await this.databaseService.conversation.findMany({
      where: { missionId: mission.id },
      select: { id: true },
    });
    this.eventEmitter.emit('mission.status-changed', {
      missionId: mission.id,
      status: mission.status,
      conversationIds: conversations.map((c) => c.id),
    });
  }

  /** Valide la transition et renvoie le statut de départ (pour le verrou). */
  private async validateStatusTransition(id: string, next: MissionStatus) {
    const mission = await this.missions.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!mission) return null;

    const allowed: Record<MissionStatus, MissionStatus[]> = {
      PENDING: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['IN_TRANSIT', 'CANCELLED', 'DISPUTED'],
      // No CANCELLED from IN_TRANSIT — carrier has the package, must dispute first
      IN_TRANSIT: ['COMPLETED', 'DISPUTED'],
      COMPLETED: [],
      CANCELLED: [],
      // Sortie d'un litige réservée à l'admin (DisputesService.resolve écrit le
      // statut en direct, hors de cette matrice) → aucune transition manuelle.
      DISPUTED: [],
    };

    if (!allowed[mission.status].includes(next)) {
      throw new BadRequestException(
        `Cannot transition mission from ${mission.status} to ${next}`,
      );
    }
    return mission.status;
  }
  async verifyPackagesOwnership(
    packageIds: string[],
    ownerId: string,
  ): Promise<boolean> {
    const count = await this.databaseService.package.count({
      where: { id: { in: packageIds }, ownerId },
    });
    return count === packageIds.length;
  }

  async delete(id: UUID) {
    return this.missions.delete({ where: { id } });
  }
}
