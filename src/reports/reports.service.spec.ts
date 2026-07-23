import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

// Unité pure : DatabaseService mocké.

const makeDb = () => ({
  report: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
});

describe('ReportsService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ReportsService;

  beforeEach(() => {
    db = makeDb();
    service = new ReportsService(db as never);
  });

  describe('create', () => {
    it('anti self-report : BadRequest si USER et targetId === reporterId (sans create)', () => {
      expect(() =>
        service.create('u1', {
          targetType: 'USER',
          targetId: 'u1',
          reason: 'SPAM',
          description: 'x',
        } as never),
      ).toThrow(BadRequestException);
      expect(db.report.create).not.toHaveBeenCalled();
    });

    it('happy path : create appelé avec reporterId FORCÉ + champs du DTO', () => {
      db.report.create.mockReturnValue({ id: 'r1' });

      service.create('u1', {
        targetType: 'USER',
        targetId: 'u2',
        reason: 'SPAM',
        description: 'abus',
      } as never);

      expect(db.report.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'u1',
          targetType: 'USER',
          targetId: 'u2',
          reason: 'SPAM',
          description: 'abus',
        },
      });
    });

    it('signaler un AUTRE user (targetId != reporterId) passe', () => {
      db.report.create.mockReturnValue({ id: 'r1' });

      service.create('u1', {
        targetType: 'USER',
        targetId: 'u2',
        reason: 'SPAM',
        description: 'x',
      } as never);

      expect(db.report.create).toHaveBeenCalled();
    });

    it('targetType non-USER avec targetId === reporterId passe (garde uniquement USER)', () => {
      db.report.create.mockReturnValue({ id: 'r1' });

      service.create('u1', {
        targetType: 'MISSION',
        targetId: 'u1',
        reason: 'SPAM',
        description: 'x',
      } as never);

      expect(db.report.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'u1',
          targetType: 'MISSION',
          targetId: 'u1',
          reason: 'SPAM',
          description: 'x',
        },
      });
    });
  });

  describe('findAll', () => {
    it('sans filtre : where undefined', () => {
      db.report.findMany.mockReturnValue([]);

      service.findAll();

      expect(db.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('avec status : where { status }', () => {
      db.report.findMany.mockReturnValue([]);

      service.findAll('PENDING' as never);

      expect(db.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } }),
      );
    });
  });

  describe('resolve', () => {
    it('NotFound si findUnique → null', async () => {
      db.report.findUnique.mockResolvedValue(null);

      await expect(
        service.resolve('r1', 'admin1', {} as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(db.report.updateMany).not.toHaveBeenCalled();
    });

    it('happy : verrou optimiste sur OPEN + reviewedById + reviewedAt (Date)', async () => {
      db.report.findUnique
        .mockResolvedValueOnce({ status: 'OPEN' })
        .mockResolvedValueOnce({ id: 'r1' });
      db.report.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.resolve('r1', 'admin1', {
        status: 'RESOLVED',
        resolution: 'traité',
      } as never);

      expect(res).toEqual({ id: 'r1' });
      expect(db.report.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'OPEN' },
        data: {
          status: 'RESOLVED',
          resolution: 'traité',
          reviewedById: 'admin1',
          reviewedAt: expect.any(Date),
        },
      });
    });

    it('déjà résolu (count 0) → BadRequest, pas de double écriture', async () => {
      db.report.findUnique.mockResolvedValue({ status: 'REVIEWED' });
      db.report.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resolve('r1', 'admin2', {
          status: 'RESOLVED',
          resolution: 'bis',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
