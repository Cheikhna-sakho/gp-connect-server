import { BadRequestException } from '@nestjs/common';
import { BlocksService } from './blocks.service';

// Unité pure : DatabaseService mocké.

const makeDb = () => ({
  userBlock: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

const prismaErr = (code: string) => Object.assign(new Error(code), { code });

describe('BlocksService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: BlocksService;

  beforeEach(() => {
    db = makeDb();
    service = new BlocksService(db as never);
  });

  describe('block', () => {
    it('self-block (blockerId === blockedId) → BadRequestException sans appeler create', async () => {
      await expect(service.block('u1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.block('u1', 'u1')).rejects.toThrow(
        'You cannot block yourself',
      );
      expect(db.userBlock.create).not.toHaveBeenCalled();
    });

    it('happy path : appelle userBlock.create avec {blockerId, blockedId}', async () => {
      const created = { id: 'b1', blockerId: 'u1', blockedId: 'u2' };
      db.userBlock.create.mockResolvedValue(created);

      const res = await service.block('u1', 'u2');

      expect(db.userBlock.create).toHaveBeenCalledWith({
        data: { blockerId: 'u1', blockedId: 'u2' },
      });
      expect(res).toBe(created);
    });

    it('P2002 (déjà bloqué) → idempotent, renvoie l’existant via findUnique', async () => {
      db.userBlock.create.mockRejectedValue(prismaErr('P2002'));
      const existing = { id: 'b1', blockerId: 'u1', blockedId: 'u2' };
      db.userBlock.findUnique.mockResolvedValue(existing);

      const res = await service.block('u1', 'u2');

      expect(db.userBlock.findUnique).toHaveBeenCalledWith({
        where: { blockerId_blockedId: { blockerId: 'u1', blockedId: 'u2' } },
      });
      expect(res).toBe(existing);
    });

    it('P2003 (cible inexistante) → BadRequestException("User not found")', async () => {
      db.userBlock.create.mockRejectedValue(prismaErr('P2003'));

      await expect(service.block('u1', 'u2')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.block('u1', 'u2')).rejects.toThrow('User not found');
    });
  });

  describe('unblock', () => {
    it('appelle deleteMany avec {blockerId, blockedId} et ne lève pas (idempotent)', async () => {
      db.userBlock.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unblock('u1', 'u2')).resolves.toBeUndefined();
      expect(db.userBlock.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'u1', blockedId: 'u2' },
      });
    });
  });

  describe('list', () => {
    it('mappe les résultats sur .blocked', async () => {
      db.userBlock.findMany.mockResolvedValue([{ blocked: { id: 'u2' } }]);

      const res = await service.list('u1');

      expect(res).toEqual([{ id: 'u2' }]);
    });
  });

  describe('isBlockedBetween', () => {
    it('renvoie true si count > 0 et teste les deux sens', async () => {
      db.userBlock.count.mockResolvedValue(1);

      const res = await service.isBlockedBetween('a', 'b');

      expect(res).toBe(true);
      expect(db.userBlock.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { blockerId: 'a', blockedId: 'b' },
            { blockerId: 'b', blockedId: 'a' },
          ],
        },
      });
    });

    it('renvoie false si count === 0', async () => {
      db.userBlock.count.mockResolvedValue(0);

      await expect(service.isBlockedBetween('a', 'b')).resolves.toBe(false);
    });
  });
});
