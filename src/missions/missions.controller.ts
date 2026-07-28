import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from 'src/common/decorators/api-auth.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dtos/create-mission.dto';
import { Roles } from 'src/auth/decorators/role.decorator';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { GetUserId } from 'src/common/decorators/user.decorator';
import { UUID } from 'crypto';
import { MissionQuery } from './dtos/mission-query.dto';
import { ProofService } from 'src/proof/proof.service';
import { MissionPackagesDto } from './dtos/mission-packages.dto';
import { ID_PARAM, SetIdParam } from 'src/common/constants/route.util.const';
import { UpdateMissionDto } from './dtos/update-mission.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { SerializePage } from 'src/common/decorators/serialize-page.decorator';
import { MissionEntity } from './entities/mission.entity';
import { ProofEntity } from 'src/proof/entities/proof.entity';
import { ProofOtpEntity } from 'src/proof/entities/proof-otp.entity';
import { VerifyProofDto } from 'src/proof/dtos/verify-proof.dto';

@ApiTags('missions')
@ApiAuth()
@Controller('missions')
export class MissionsController {
  constructor(
    private readonly missionsService: MissionsService,
    private readonly proofsService: ProofService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('/all')
  @Serialize(MissionEntity)
  getAll() {
    return this.missionsService.findAll();
  }

  @Get()
  @SerializePage(MissionEntity)
  getOwn(@GetUserId() id: UUID, @Query() where: MissionQuery) {
    return this.missionsService.findByUser(id, where);
  }

  @Get(ID_PARAM)
  @Serialize(MissionEntity)
  getOne(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    return this.missionsService.findOneForUser(id as string, userId as string);
  }

  @UseGuards(RolesGuard)
  @Roles('SHIPPER')
  @ApiNotFoundResponse({ description: 'Annonce inconnue' })
  @ApiForbiddenResponse({
    description: "Colis n'appartenant pas à l'expéditeur",
  })
  @Post()
  @Serialize(MissionEntity)
  create(@GetUserId() shipperId: UUID, @Body() data: CreateMissionDto) {
    return this.missionsService.create({ ...data, shipperId });
  }

  @Post(`${ID_PARAM}/packages`)
  @HttpCode(HttpStatus.NO_CONTENT)
  async addPackages(
    @GetUserId() userId: UUID,
    @Param('id') missionId: string,
    @Body() { packageIds }: MissionPackagesDto,
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    if (mission.shipperId !== userId) throw new ForbiddenException();
    // Le périmètre (colis) est figé dès qu'un transporteur a accepté : il a
    // négocié un prix pour CE lot. En ajouter après changerait le deal sans son
    // accord → ajout autorisé uniquement tant que la mission est PENDING.
    if (mission.status !== 'PENDING') {
      throw new BadRequestException(
        'Packages can only be added before a carrier accepts the mission',
      );
    }
    const owned = await this.missionsService.verifyPackagesOwnership(
      packageIds,
      userId,
    );
    if (!owned)
      throw new ForbiddenException('One or more packages do not belong to you');
    return this.missionsService.addPackages(missionId, packageIds);
  }

  // ─── Proof creation (Shipper) ─────────────────────────────────────────────

  @Post(':id/proof/pickup')
  @Serialize(ProofOtpEntity)
  async createPickupProof(
    @GetUserId() userId: UUID,
    @Param('id') missionId: string,
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    if (mission.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Mission must be accepted before generating a proof',
      );
    }
    if (mission.shipperId !== userId) throw new ForbiddenException();
    if (!mission.carrierId)
      throw new BadRequestException('No carrier assigned to this mission yet');
    return this.proofsService.create({
      missionId,
      type: 'PICKUP',
      createdById: mission.shipperId,
      verifiedById: mission.carrierId,
    });
  }

  @Post(':id/proof/delivery')
  @Serialize(ProofOtpEntity)
  createDeliveryProof(
    @GetUserId() userId: UUID,
    @Param('id') missionId: string,
  ) {
    // Règle métier (SMS destinataire, code non renvoyé au shipper) : dans
    // ProofService.generateDeliveryCode — le contrôleur ne fait que déléguer.
    return this.proofsService.generateDeliveryCode(missionId, userId);
  }

  // ─── Proof verification (Carrier) ─────────────────────────────────────────

  /** Vérifie l'OTP de ramassage : colis PICKED_UP, mission IN_TRANSIT. */
  @ApiBadRequestResponse({
    description: 'Code invalide, expiré, déjà utilisé, ou trop d’essais',
  })
  @Post(':id/verify/pickup')
  @Serialize(ProofEntity)
  async verifyPickUp(
    @GetUserId() verifiedById: UUID,
    @Param('id') missionId: string,
    @Body() { code }: VerifyProofDto,
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    if (mission.status !== 'ACCEPTED')
      throw new BadRequestException('Mission is not in an active state');
    if (mission.carrierId !== verifiedById) throw new ForbiddenException();
    return this.proofsService.verify({
      missionId,
      code,
      type: 'PICKUP',
      verifiedById,
    });
  }

  /** Vérifie l'OTP de livraison : colis DELIVERED, mission/annonce COMPLETED, transaction COMPLETED. */
  @ApiBadRequestResponse({
    description: 'Code invalide, expiré, déjà utilisé, ou trop d’essais',
  })
  @Post(':id/verify/delivery')
  @Serialize(ProofEntity)
  async verifyDelivery(
    @GetUserId() verifiedById: UUID,
    @Param('id') missionId: string,
    @Body() { code }: VerifyProofDto,
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    // La livraison se vérifie pendant le transport (IN_TRANSIT)
    if (mission.status !== 'IN_TRANSIT')
      throw new BadRequestException('Mission is not in transit');
    if (mission.carrierId !== verifiedById) throw new ForbiddenException();
    return this.proofsService.verify({
      missionId,
      code,
      type: 'DELIVERY',
      verifiedById,
    });
  }

  // ─── Proof images ─────────────────────────────────────────────────────────

  @Post(':id/proof/pickup/images')
  @Serialize(ProofEntity)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException(`File type not allowed: ${file.mimetype}`),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadPickupImages(
    @GetUserId() userId: UUID,
    @Param('id') missionId: string,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    if (userId !== mission.shipperId && userId !== mission.carrierId)
      throw new ForbiddenException();
    if (!images?.length)
      throw new BadRequestException('At least one image is required');
    return this.proofsService.addImages(
      missionId,
      'PICKUP',
      mission.shipperId,
      mission.carrierId,
      images,
    );
  }

  @Post(':id/proof/delivery/images')
  @Serialize(ProofEntity)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException(`File type not allowed: ${file.mimetype}`),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadDeliveryImages(
    @GetUserId() userId: UUID,
    @Param('id') missionId: string,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    if (userId !== mission.shipperId && userId !== mission.carrierId)
      throw new ForbiddenException();
    if (!images?.length)
      throw new BadRequestException('At least one image is required');
    return this.proofsService.addImages(
      missionId,
      'DELIVERY',
      mission.shipperId,
      mission.carrierId,
      images,
    );
  }

  /** Transition de statut (machine à états) ou mise à jour du destinataire. */
  @ApiBadRequestResponse({
    description:
      'Transition interdite par la machine à états, ou statut modifié concurremment',
  })
  @Patch(ID_PARAM)
  @Serialize(MissionEntity)
  async update(
    @GetUserId() userId: UUID,
    @Param('id') id: UUID,
    @Body() data: UpdateMissionDto,
  ) {
    const mission = await this.missionsService.findOne(id as UUID);
    if (!mission) throw new NotFoundException();
    if (userId !== mission.shipperId && userId !== mission.carrierId) {
      throw new ForbiddenException();
    }
    // Only CANCELLED can be set manually here
    // ACCEPTED: via offer acceptance | IN_TRANSIT + COMPLETED: via proof system
    // DISPUTED: via POST /disputes/mission/:id (stores reason + description)
    const MANUAL_ALLOWED = ['CANCELLED'];
    if (data.status && !MANUAL_ALLOWED.includes(data.status)) {
      throw new BadRequestException(
        `Cannot manually set status to ${data.status}. This happens automatically.`,
      );
    }
    // Une mission en litige ne peut PAS être annulée unilatéralement par une
    // partie : sa sortie passe par la résolution admin (PATCH /disputes/:id),
    // sinon on court-circuiterait l'arbitrage et le litige resterait OPEN.
    if (data.status === 'CANCELLED' && mission.status === 'DISPUTED') {
      throw new ForbiddenException(
        'A mission under dispute can only be resolved by support',
      );
    }
    // carrierId is set exclusively via offer acceptance — never manually
    if ('carrierId' in data) {
      throw new BadRequestException(
        'carrierId cannot be set manually. It is assigned via offer acceptance.',
      );
    }
    // Le destinataire est renseigné par le shipper, tant que la mission est active
    if ('recipientName' in data || 'recipientPhone' in data) {
      if (userId !== mission.shipperId) {
        throw new ForbiddenException('Only the shipper can set the recipient');
      }
      if (!['PENDING', 'ACCEPTED', 'IN_TRANSIT'].includes(mission.status)) {
        throw new BadRequestException(
          'Recipient can only be set while the mission is active',
        );
      }
    }
    return this.missionsService.update(id, data);
  }

  @Delete(ID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@GetUserId() userId: UUID, @Param('id') id: UUID) {
    const mission = await this.missionsService.findOne(id as UUID);
    if (!mission) throw new NotFoundException();
    if (mission.shipperId !== userId) throw new ForbiddenException();
    if (!['PENDING', 'CANCELLED'].includes(mission.status)) {
      throw new BadRequestException(
        'Only PENDING or CANCELLED missions can be deleted',
      );
    }
    return this.missionsService.delete(id as UUID);
  }

  @Delete(`${ID_PARAM}/packages/${SetIdParam('packageId')}`)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePackage(
    @GetUserId() userId: UUID,
    @Param('id') missionId: string,
    @Param('packageId') packageId: string,
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    if (mission.shipperId !== userId) throw new ForbiddenException();
    // Miroir de l'ajout : le périmètre est figé une fois le transporteur engagé
    // (et a fortiori après ramassage) — sinon désync des colis déjà PICKED_UP.
    if (mission.status !== 'PENDING') {
      throw new BadRequestException(
        'Packages can only be removed before a carrier accepts the mission',
      );
    }
    return this.missionsService.removePackage(missionId, packageId);
  }
}
