import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UUID } from 'crypto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Test unitaire du contrôleur : UsersService est mocké. On vérifie la logique
// propre au contrôleur (gardes, délégation), pas la couche HTTP/guards (→ e2e).

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<Pick<UsersService, 'findOne' | 'createAvatar'>>;

  beforeEach(async () => {
    service = {
      findOne: jest.fn(),
      createAvatar: jest.fn(),
    } as never;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('est défini', () => {
    expect(controller).toBeDefined();
  });

  describe('getOneUser', () => {
    it('renvoie NotFound quand le service ne trouve personne', async () => {
      service.findOne.mockResolvedValue(null as never);
      await expect(
        controller.getOneUser('missing' as UUID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("renvoie l'utilisateur trouvé", async () => {
      const user = { id: 'u1' };
      service.findOne.mockResolvedValue(user as never);
      await expect(controller.getOneUser('u1' as UUID)).resolves.toBe(user);
    });
  });

  describe('avatar', () => {
    it('lève BadRequest si aucun fichier fourni', () => {
      expect(() => controller.avatar('u1' as UUID, undefined as never)).toThrow(
        BadRequestException,
      );
      expect(service.createAvatar).not.toHaveBeenCalled();
    });

    it('délègue à createAvatar quand un fichier est fourni', () => {
      const file = { originalname: 'a.png' } as Express.Multer.File;
      controller.avatar('u1' as UUID, file);
      expect(service.createAvatar).toHaveBeenCalledWith('u1', file);
    });
  });
});
