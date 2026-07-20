import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';

const MISSION = 'm1';
const SHIPPER = 'ship1';
const CARRIER = 'carr1';
const TX_ID = 'tx1';

const makeDb = () => ({
  transaction: { findUnique: jest.fn(), update: jest.fn() },
  mission: { findFirst: jest.fn() },
});

describe('TransactionsService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: TransactionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    db = makeDb();
    service = new TransactionsService(db as never);
  });

  describe('findByMission', () => {
    it('Forbidden si le user ne participe pas à la mission', async () => {
      db.mission.findFirst.mockResolvedValue(null);
      await expect(
        service.findByMission(MISSION, CARRIER),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.transaction.findUnique).not.toHaveBeenCalled();
    });

    it('NotFound si participant mais aucune transaction', async () => {
      db.mission.findFirst.mockResolvedValue({ id: MISSION });
      db.transaction.findUnique.mockResolvedValue(null);
      await expect(service.findByMission(MISSION, CARRIER)).rejects.toThrow(
        'No transaction for this mission yet',
      );
    });

    it('happy : renvoie la transaction', async () => {
      const tx = { id: TX_ID, missionId: MISSION };
      db.mission.findFirst.mockResolvedValue({ id: MISSION });
      db.transaction.findUnique.mockResolvedValue(tx);

      const res = await service.findByMission(MISSION, CARRIER);

      expect(res).toBe(tx);
      expect(db.transaction.findUnique).toHaveBeenCalledWith({
        where: { missionId: MISSION },
      });
    });
  });

  describe('update', () => {
    const validTx = (over: Record<string, unknown> = {}) => ({
      id: TX_ID,
      status: 'PENDING',
      mission: { shipperId: SHIPPER, carrierId: CARRIER },
      ...over,
    });

    it('NotFound si la transaction est introuvable', async () => {
      db.transaction.findUnique.mockResolvedValue(null);
      await expect(
        service.update(TX_ID, SHIPPER, { method: 'CASH' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("Forbidden si l'appelant n'est pas le shipper", async () => {
      db.transaction.findUnique.mockResolvedValue(validTx());
      await expect(
        service.update(TX_ID, CARRIER, { method: 'CASH' } as never),
      ).rejects.toThrow('Only the shipper can update the payment method');
    });

    it("BadRequest si la transaction n'est pas PENDING", async () => {
      db.transaction.findUnique.mockResolvedValue(
        validTx({ status: 'COMPLETED' }),
      );
      await expect(
        service.update(TX_ID, SHIPPER, { method: 'CASH' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('happy : shipper + PENDING -> update avec les données', async () => {
      const updated = { id: TX_ID, method: 'CASH' };
      db.transaction.findUnique.mockResolvedValue(validTx());
      db.transaction.update.mockResolvedValue(updated);

      const res = await service.update(TX_ID, SHIPPER, {
        method: 'CASH',
      } as never);

      expect(res).toBe(updated);
      expect(db.transaction.update).toHaveBeenCalledWith({
        where: { id: TX_ID },
        data: { method: 'CASH' },
      });
    });
  });
});
