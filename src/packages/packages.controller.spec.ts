import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UUID } from 'crypto';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

// Test unitaire du contrôleur : service mocké. On verrouille les GARDES
// (owner-only sur getOne/createImages/update, gel si lié à une mission,
// ownerId forcé à la création).

const OWNER = 'u1' as UUID;
const OTHER = 'intrus' as UUID;
const PID = 'p1' as UUID;

describe('PackagesController', () => {
  let controller: PackagesController;
  let svc: jest.Mocked<
    Pick<
      PackagesService,
      | 'findBy'
      | 'findAllByUser'
      | 'create'
      | 'createWithImages'
      | 'createImage'
      | 'update'
      | 'delete'
    >
  >;

  beforeEach(() => {
    svc = {
      findBy: jest.fn(),
      findAllByUser: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      createWithImages: jest.fn().mockResolvedValue({}),
      createImage: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    } as never;
    controller = new PackagesController(svc as never);
  });

  describe('getOne (owner-only — IDOR)', () => {
    it("NotFound si le colis n'existe pas", async () => {
      svc.findBy.mockResolvedValue(null as never);
      await expect(controller.getOne(OWNER, PID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("Forbidden si l'appelant n'est pas le propriétaire", async () => {
      svc.findBy.mockResolvedValue({ ownerId: OTHER } as never);
      await expect(controller.getOne(OWNER, PID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('propriétaire : renvoie le colis', async () => {
      const pkg = { ownerId: OWNER };
      svc.findBy.mockResolvedValue(pkg as never);
      await expect(controller.getOne(OWNER, PID)).resolves.toBe(pkg);
    });
  });

  describe('create / createWithImages — ownerId forcé', () => {
    it('create force ownerId depuis le token', () => {
      const data: Record<string, unknown> = { name: 'X', ownerId: 'usurpé' };
      controller.create(OWNER, data as never);
      expect(data.ownerId).toBe(OWNER);
      expect(svc.create).toHaveBeenCalledWith(data);
    });

    it('createWithImages force ownerId', () => {
      const data: Record<string, unknown> = { name: 'X' };
      controller.createWithImages([], OWNER, data as never);
      expect(svc.createWithImages).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: OWNER }),
      );
    });
  });

  describe('createImages (owner-only)', () => {
    it('Forbidden si non-propriétaire', async () => {
      svc.findBy.mockResolvedValue({ ownerId: OTHER } as never);
      await expect(
        controller.createImages(OWNER, PID, []),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(svc.createImage).not.toHaveBeenCalled();
    });
  });

  describe('update (owner-only + gel si lié à une mission)', () => {
    it('Forbidden si non-propriétaire', async () => {
      svc.findBy.mockResolvedValue({ ownerId: OTHER, mission: [] } as never);
      await expect(
        controller.update(OWNER, PID, { name: 'x' } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('BadRequest si le colis est engagé dans une mission (figé)', async () => {
      svc.findBy.mockResolvedValue({
        ownerId: OWNER,
        mission: [{ missionId: 'm1' }],
      } as never);
      await expect(
        controller.update(OWNER, PID, { name: 'x' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(svc.update).not.toHaveBeenCalled();
    });

    it('happy : propriétaire, colis libre → met à jour', async () => {
      svc.findBy.mockResolvedValue({ ownerId: OWNER, mission: [] } as never);
      await controller.update(OWNER, PID, { name: 'x' } as never);
      expect(svc.update).toHaveBeenCalledWith(PID, { name: 'x' });
    });
  });

  describe('delete', () => {
    it('délègue au service avec (id, ownerId) — la garde owner/gel est côté service', () => {
      controller.delete(OWNER, PID);
      expect(svc.delete).toHaveBeenCalledWith(PID, OWNER);
    });
  });
});
