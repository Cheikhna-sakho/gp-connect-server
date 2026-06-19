import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { USER_DEFAULT_INCLUDE } from 'src/users/entities/user.entity';

@Injectable()
export class BlocksService {
  constructor(private readonly db: DatabaseService) {}

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }
    try {
      return await this.db.userBlock.create({ data: { blockerId, blockedId } });
    } catch (e: any) {
      // Déjà bloqué → idempotent. Cible inexistante (FK) → 400 propre.
      if (e?.code === 'P2002') {
        return this.db.userBlock.findUnique({
          where: { blockerId_blockedId: { blockerId, blockedId } },
        });
      }
      if (e?.code === 'P2003') {
        throw new BadRequestException('User not found');
      }
      throw e;
    }
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.db.userBlock.deleteMany({ where: { blockerId, blockedId } });
  }

  async list(blockerId: string) {
    const blocks = await this.db.userBlock.findMany({
      where: { blockerId },
      include: { blocked: { include: USER_DEFAULT_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((b) => b.blocked);
  }

  // Vrai si l'un a bloqué l'autre (dans un sens OU dans l'autre).
  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const count = await this.db.userBlock.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return count > 0;
  }
}
