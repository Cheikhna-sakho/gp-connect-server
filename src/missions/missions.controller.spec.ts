import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { ProofService } from 'src/proof/proof.service';

// Test unitaire du contrôleur : services mockés. On verrouille les GARDES
// (participant, machine à états manuelle, blocage des champs dérivés serveur,
// propriété des colis, gate d'état des preuves) — pas la couche HTTP (→ e2e).

const SHIPPER = 'ship1' as UUID;
const CARRIER = 'carr1' as UUID;
const OTHER = 'intrus' as UUID;
const MID = 'm1';

const mission = (over: Record<string, unknown> = {}) => ({
  id: MID,
  shipperId: SHIPPER,
  carrierId: CARRIER,
  status: 'ACCEPTED',
  ...over,
});

describe('MissionsController', () => {
  let controller: MissionsController;
  let missions: jest.Mocked<
    Pick<
      MissionsService,
      | 'findOne'
      | 'update'
      | 'delete'
      | 'addPackages'
      | 'verifyPackagesOwnership'
    >
  >;
  let proofs: jest.Mocked<Pick<ProofService, 'create'>>;

  beforeEach(() => {
    missions = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      addPackages: jest.fn().mockResolvedValue({}),
      verifyPackagesOwnership: jest.fn(),
    } as never;
    proofs = { create: jest.fn().mockResolvedValue({}) } as never;
    controller = new MissionsController(missions as never, proofs as never);
  });

  describe('update', () => {
    it("NotFound si la mission n'existe pas", async () => {
      missions.findOne.mockResolvedValue(null as never);
      await expect(
        controller.update(SHIPPER, MID as UUID, {} as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Forbidden pour un non-participant', async () => {
      missions.findOne.mockResolvedValue(mission() as never);
      await expect(
        controller.update(OTHER, MID as UUID, { recipientName: 'x' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('BadRequest si on force un statut autre que CANCELLED', async () => {
      missions.findOne.mockResolvedValue(mission() as never);
      await expect(
        controller.update(
          SHIPPER,
          MID as UUID,
          { status: 'IN_TRANSIT' } as never,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Forbidden : CANCELLED interdit sur une mission en litige (réservé admin)', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'DISPUTED' }) as never,
      );
      await expect(
        controller.update(
          SHIPPER,
          MID as UUID,
          { status: 'CANCELLED' } as never,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('BadRequest si carrierId est présent dans le body (jamais manuel)', async () => {
      missions.findOne.mockResolvedValue(mission() as never);
      await expect(
        controller.update(SHIPPER, MID as UUID, { carrierId: 'x' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Forbidden : seul le shipper peut renseigner le destinataire', async () => {
      missions.findOne.mockResolvedValue(mission() as never);
      await expect(
        controller.update(
          CARRIER,
          MID as UUID,
          { recipientName: 'x' } as never,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('BadRequest : destinataire refusé sur une mission non active', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'COMPLETED' }) as never,
      );
      await expect(
        controller.update(
          SHIPPER,
          MID as UUID,
          { recipientName: 'x' } as never,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('happy : annulation par le shipper → délègue au service', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'PENDING' }) as never,
      );
      await controller.update(
        SHIPPER,
        MID as UUID,
        { status: 'CANCELLED' } as never,
      );
      expect(missions.update).toHaveBeenCalledWith(MID, {
        status: 'CANCELLED',
      });
    });
  });

  describe('addPackages', () => {
    it("Forbidden si l'appelant n'est pas le shipper", async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'PENDING' }) as never,
      );
      await expect(
        controller.addPackages(CARRIER, MID, { packageIds: ['p1'] } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("BadRequest si la mission n'est plus PENDING (périmètre figé)", async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'ACCEPTED' }) as never,
      );
      await expect(
        controller.addPackages(SHIPPER, MID, { packageIds: ['p1'] } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("Forbidden si un colis n'appartient pas au shipper", async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'PENDING' }) as never,
      );
      missions.verifyPackagesOwnership.mockResolvedValue(false);
      await expect(
        controller.addPackages(SHIPPER, MID, {
          packageIds: ['pVictime'],
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('happy : colis possédés → délègue', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'PENDING' }) as never,
      );
      missions.verifyPackagesOwnership.mockResolvedValue(true);
      await controller.addPackages(SHIPPER, MID, {
        packageIds: ['p1'],
      } as never);
      expect(missions.addPackages).toHaveBeenCalledWith(MID, ['p1']);
    });
  });

  describe('delete', () => {
    it('Forbidden si non-shipper', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'PENDING' }) as never,
      );
      await expect(
        controller.delete(CARRIER, MID as UUID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('BadRequest si statut hors {PENDING, CANCELLED}', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'IN_TRANSIT' }) as never,
      );
      await expect(
        controller.delete(SHIPPER, MID as UUID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('happy : mission PENDING → délègue', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'PENDING' }) as never,
      );
      await controller.delete(SHIPPER, MID as UUID);
      expect(missions.delete).toHaveBeenCalledWith(MID);
    });
  });

  describe('createPickupProof', () => {
    it("BadRequest si la mission n'est pas ACCEPTED", async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'IN_TRANSIT' }) as never,
      );
      await expect(
        controller.createPickupProof(SHIPPER, MID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("Forbidden si l'appelant n'est pas le shipper", async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'ACCEPTED' }) as never,
      );
      await expect(
        controller.createPickupProof(CARRIER, MID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('happy : shipper sur mission ACCEPTED → génère la preuve PICKUP', async () => {
      missions.findOne.mockResolvedValue(
        mission({ status: 'ACCEPTED' }) as never,
      );
      await controller.createPickupProof(SHIPPER, MID);
      expect(proofs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          missionId: MID,
          type: 'PICKUP',
          createdById: SHIPPER,
          verifiedById: CARRIER,
        }),
      );
    });
  });
});
