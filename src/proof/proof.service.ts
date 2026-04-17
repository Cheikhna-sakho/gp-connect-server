import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ProofDto } from './dtos/proof.dto';
import { generateOtp, verifyOtp } from 'src/common/utils/otp.util';
import { ProofType } from '@prisma/client';

@Injectable()
export class ProofService {
  private proofs: DatabaseService['missionProof'];
  constructor(private readonly databaseService: DatabaseService) {
    this.proofs = this.databaseService.missionProof;
  }

  async create(data: ProofDto) {
    const { hash, expiresAt } = await generateOtp();
    // send plain to data.createdById
    // const a={...data}
    return this.proofs.create({
      data: {
        ...data,
        otpExpiresAt: expiresAt,
        otpHash: hash,
      },
    });
  }

  async verify({
    missionId,
    type,
    code,
    verifiedById,
  }: {
    missionId: string;
    code: string;
    type: ProofType;
    verifiedById: string;
  }) {
    const proof = await this.proofs.findUnique({
      where: {
        missionId_type: { missionId, type },
      },
    });
    if (!proof) throw new NotFoundException('');
    if (
      proof.otpExpiresAt < new Date() ||
      proof.verifiedById !== verifiedById
    ) {
      throw new BadRequestException();
    }
    const { otpHash } = proof;
    const isVerified = await verifyOtp({ hash: otpHash, plain: code });
    if (!isVerified) {
      //use bcrypt
      throw new ForbiddenException();
    }
    return this.proofs.update({
      where: {
        id: proof.id,
      },
      data: {
        otpUsedAt: new Date(),
      },
    });
  }
}
