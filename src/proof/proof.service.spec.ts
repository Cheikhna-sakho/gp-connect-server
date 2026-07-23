import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProofService } from './proof.service';
import { generateOtp, verifyOtp } from 'src/common/utils/otp.util';

// On mocke l'util OTP pour contrôler la génération/vérification (sinon bcrypt réel).
jest.mock('src/common/utils/otp.util', () => ({
  generateOtp: jest.fn(),
  verifyOtp: jest.fn(),
}));

const MISSION = 'm1';
const CARRIER = 'carr1';
const future = () => new Date(Date.now() + 15 * 60_000);
const past = () => new Date(Date.now() - 60_000);

// proof valide prêt à vérifier (code présent, non utilisé, non expiré, 0 essai)
const validProof = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  otpHash: 'HASH',
  otpUsedAt: null,
  otpExpiresAt: future(),
  verifiedById: null,
  otpAttempts: 0,
  ...over,
});

const makeDb = () => {
  const tx = {
    missionProof: {
      update: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    missionPackage: {
      findMany: jest.fn().mockResolvedValue([{ packageId: 'pk1' }]),
    },
    package: { updateMany: jest.fn() },
    mission: { update: jest.fn(), findUnique: jest.fn() },
    advertisement: { update: jest.fn() },
    transaction: { updateMany: jest.fn() },
    conversation: { findMany: jest.fn().mockResolvedValue([{ id: 'c1' }]) },
  };
  return {
    missionProof: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    missionProofImage: { createMany: jest.fn() },
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    __tx: tx,
  };
};

describe('ProofService', () => {
  let db: ReturnType<typeof makeDb>;
  let emitter: { emit: jest.Mock };
  let service: ProofService;
  const genOtp = generateOtp as jest.Mock;
  const chkOtp = verifyOtp as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db = makeDb();
    emitter = { emit: jest.fn() };
    service = new ProofService(db as never, emitter as never, {} as never);
  });

  describe('create', () => {
    it('génère un OTP et upsert la preuve (reset attempts/used sur régénération)', async () => {
      const exp = future();
      genOtp.mockResolvedValue({ plain: '123456', hash: 'H', expiresAt: exp });

      const res = await service.create({
        missionId: MISSION,
        type: 'PICKUP',
        createdById: 'ship1',
        verifiedById: CARRIER,
      } as never);

      expect(res).toEqual({ code: '123456', expiresAt: exp });
      const arg = db.missionProof.upsert.mock.calls[0][0];
      expect(arg.create).toEqual(
        expect.objectContaining({ otpHash: 'H', otpExpiresAt: exp }),
      );
      expect(arg.update).toEqual(
        expect.objectContaining({
          otpHash: 'H',
          otpUsedAt: null,
          otpAttempts: 0,
        }),
      );
    });
  });

  describe('verify — gardes', () => {
    const verify = (over = {}) =>
      service.verify({
        missionId: MISSION,
        type: 'PICKUP',
        code: '000000',
        verifiedById: CARRIER,
        ...over,
      });

    it('NotFound si aucune preuve', async () => {
      db.missionProof.findUnique.mockResolvedValue(null);
      await expect(verify()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('BadRequest si aucun code généré (otpHash null)', async () => {
      db.missionProof.findUnique.mockResolvedValue(
        validProof({ otpHash: null }),
      );
      await expect(verify()).rejects.toThrow('No code generated yet');
    });

    it('BadRequest si le code a déjà été utilisé', async () => {
      db.missionProof.findUnique.mockResolvedValue(
        validProof({ otpUsedAt: new Date() }),
      );
      await expect(verify()).rejects.toThrow('already been used');
    });

    it('BadRequest si le code est expiré', async () => {
      db.missionProof.findUnique.mockResolvedValue(
        validProof({ otpExpiresAt: past() }),
      );
      await expect(verify()).rejects.toThrow('expired');
    });

    it('Forbidden si un autre destinataire que le vérificateur attendu', async () => {
      db.missionProof.findUnique.mockResolvedValue(
        validProof({ verifiedById: 'autre' }),
      );
      await expect(verify()).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('BadRequest (anti brute-force) au-delà de MAX_OTP_ATTEMPTS', async () => {
      db.missionProof.findUnique.mockResolvedValue(
        validProof({ otpAttempts: ProofService.MAX_OTP_ATTEMPTS }),
      );
      await expect(verify()).rejects.toThrow('Too many attempts');
      expect(chkOtp).not.toHaveBeenCalled();
    });

    it('code invalide : incrémente le compteur et lève BadRequest', async () => {
      db.missionProof.findUnique.mockResolvedValue(validProof());
      chkOtp.mockResolvedValue(false);

      await expect(verify()).rejects.toThrow('Invalid code');
      expect(db.missionProof.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { otpAttempts: { increment: 1 } },
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('verify — succès', () => {
    it('PICKUP : colis PICKED_UP + mission IN_TRANSIT + event proof.verified', async () => {
      db.missionProof.findUnique.mockResolvedValue(validProof());
      chkOtp.mockResolvedValue(true);
      db.__tx.missionProof.findUnique.mockResolvedValue({
        id: 'p1',
        otpUsedAt: new Date(),
      });

      await service.verify({
        missionId: MISSION,
        type: 'PICKUP',
        code: '123456',
        verifiedById: CARRIER,
      });

      // Verrou anti double-emploi : le WHERE porte otpUsedAt null.
      expect(db.__tx.missionProof.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', otpUsedAt: null },
          data: expect.objectContaining({ verifiedById: CARRIER }),
        }),
      );
      expect(db.__tx.package.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PICKED_UP' } }),
      );
      expect(db.__tx.mission.update).toHaveBeenCalledWith({
        where: { id: MISSION },
        data: { status: 'IN_TRANSIT' },
      });
      // pas d'effets DELIVERY
      expect(db.__tx.advertisement.update).not.toHaveBeenCalled();
      const events = emitter.emit.mock.calls.map((c) => c[0]);
      expect(events).toContain('proof.verified');
      expect(events).not.toContain('stats.updated');
    });

    it('DELIVERY : colis DELIVERED + mission/annonce COMPLETED + transaction COMPLETED + events', async () => {
      db.missionProof.findUnique.mockResolvedValue(validProof());
      chkOtp.mockResolvedValue(true);
      db.__tx.mission.findUnique.mockResolvedValue({
        advertisementId: 'ad1',
        shipperId: 'ship1',
        carrierId: CARRIER,
      });
      db.__tx.missionProof.findUnique.mockResolvedValue({ id: 'p1' });

      await service.verify({
        missionId: MISSION,
        type: 'DELIVERY',
        code: '123456',
        verifiedById: CARRIER,
      });

      expect(db.__tx.package.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DELIVERED' } }),
      );
      expect(db.__tx.mission.update).toHaveBeenCalledWith({
        where: { id: MISSION },
        data: { status: 'COMPLETED' },
      });
      expect(db.__tx.advertisement.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
      expect(db.__tx.transaction.updateMany).toHaveBeenCalledWith({
        where: { missionId: MISSION, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });
      const events = emitter.emit.mock.calls.map((c) => c[0]);
      expect(events).toEqual(
        expect.arrayContaining(['proof.verified', 'stats.updated']),
      );
    });
  });
});
