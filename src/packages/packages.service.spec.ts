import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PackagesService } from './packages.service';

// Unité pure : DatabaseService + MediasService mockés.

const makeDb = () => ({
  package: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  packageMedia: { createMany: jest.fn() },
  mission: { findFirst: jest.fn() },
});

describe('PackagesService', () => {
  let db: ReturnType<typeof makeDb>;
  let medias: { createManyImages: jest.Mock; delete: jest.Mock };
  let service: PackagesService;

  beforeEach(() => {
    db = makeDb();
    medias = {
      createManyImages: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new PackagesService(db as never, medias as never);
  });

  describe('findByMission', () => {
    it("BadRequest si l'appelant n'est pas participant de la mission", async () => {
      db.mission.findFirst.mockResolvedValue(null);
      await expect(
        service.findByMission('m1', 'intrus'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.package.findMany).not.toHaveBeenCalled();
    });

    it('participant : renvoie les colis de la mission', async () => {
      db.mission.findFirst.mockResolvedValue({ id: 'm1' });
      db.package.findMany.mockResolvedValue([{ id: 'p1' }]);
      await expect(service.findByMission('m1', 'ship1')).resolves.toEqual([
        { id: 'p1' },
      ]);
    });
  });

  describe('delete', () => {
    it("NotFound si le colis n'existe pas / n'appartient pas au owner", async () => {
      db.package.findFirst.mockResolvedValue(null);
      await expect(service.delete('p1', 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // le where est scopé {id, ownerId}
      expect(db.package.findFirst.mock.calls[0][0].where).toEqual({
        id: 'p1',
        ownerId: 'u1',
      });
    });

    it('BadRequest si le colis est lié à une mission (gel)', async () => {
      db.package.findFirst.mockResolvedValue({
        id: 'p1',
        images: [],
        mission: [{ missionId: 'm1' }],
      });
      await expect(service.delete('p1', 'u1')).rejects.toThrow(
        'linked to a mission',
      );
      expect(db.package.delete).not.toHaveBeenCalled();
    });

    it('happy : supprime les médias puis le colis', async () => {
      db.package.findFirst.mockResolvedValue({
        id: 'p1',
        images: [{ media: { id: 'md1' } }],
        mission: [],
      });

      await service.delete('p1', 'u1');

      expect(medias.delete).toHaveBeenCalledWith({ id: 'md1' });
      expect(db.package.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('createWithImages', () => {
    it('succès : crée le colis avec les médias', async () => {
      medias.createManyImages.mockResolvedValue([{ id: 'md1' }]);
      db.package.create.mockResolvedValue({ id: 'p1' });

      const res = await service.createWithImages({
        ownerId: 'u1',
        name: 'Colis',
        images: [{} as never],
      } as never);

      expect(res).toEqual({ id: 'p1' });
      expect(medias.delete).not.toHaveBeenCalled();
    });

    it('échec DB : compense en supprimant les médias uploadés, puis relève', async () => {
      medias.createManyImages.mockResolvedValue([{ id: 'md1' }, { id: 'md2' }]);
      db.package.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.createWithImages({
          ownerId: 'u1',
          images: [{} as never],
        } as never),
      ).rejects.toThrow('db down');

      expect(medias.delete).toHaveBeenCalledWith({ id: 'md1' });
      expect(medias.delete).toHaveBeenCalledWith({ id: 'md2' });
    });
  });
});
