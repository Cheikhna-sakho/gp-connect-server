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
import { MissionPartial } from './dtos/mission-partial.dto';
import { Serialize } from 'src/common/decorators/serialize.decorator';
import { SerializePage } from 'src/common/decorators/serialize-page.decorator';
import { MissionEntity } from './entities/mission.entity';
import { ProofEntity } from 'src/proof/entities/proof.entity';
import { ProofOtpEntity } from 'src/proof/entities/proof-otp.entity';

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
    if (!['PENDING', 'ACCEPTED'].includes(mission.status)) {
      throw new BadRequestException(
        'Cannot add packages once the mission is in transit',
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
  async createDeliveryProof(
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
      type: 'DELIVERY',
      createdById: mission.shipperId,
      verifiedById: mission.carrierId,
    });
  }

  // ─── Proof verification (Carrier) ─────────────────────────────────────────

  @Post(':id/verify/pickup')
  @Serialize(ProofEntity)
  async verifyPickUp(
    @GetUserId() verifiedById: UUID,
    @Param('id') missionId: string,
    @Body() { code }: { code: string },
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

  @Post(':id/verify/delivery')
  @Serialize(ProofEntity)
  async verifyDelivery(
    @GetUserId() verifiedById: UUID,
    @Param('id') missionId: string,
    @Body() { code }: { code: string },
  ) {
    const mission = await this.missionsService.findOne(missionId as UUID);
    if (!mission) throw new NotFoundException();
    if (mission.status !== 'ACCEPTED')
      throw new BadRequestException('Mission is not in an active state');
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

  @Patch(ID_PARAM)
  @Serialize(MissionEntity)
  async update(
    @GetUserId() userId: UUID,
    @Param('id') id: UUID,
    @Body() data: MissionPartial,
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
    // carrierId is set exclusively via offer acceptance — never manually
    if ('carrierId' in data) {
      throw new BadRequestException(
        'carrierId cannot be set manually. It is assigned via offer acceptance.',
      );
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
    return this.missionsService.removePackage(missionId, packageId);
  }
}
