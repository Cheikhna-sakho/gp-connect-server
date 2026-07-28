import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UUID } from 'crypto';
import { AdvertisementsController } from './advertisements.controller';
import { AdvertisementsService } from './advertisements.service';
import { AddressesService } from 'src/addresses/addresses.service';

// Test unitaire du contrôleur : services mockés. On verrouille les GARDES
// (offres réservées à l'auteur, authorId/type forcés à la création, scoping
// update/delete, authorId non surchargeable sur getMine).

const AUTHOR = 'auth1';
const AD = 'ad1' as UUID;

describe('AdvertisementsController', () => {
  let controller: AdvertisementsController;
  let ads: jest.Mocked<
    Pick<
      AdvertisementsService,
      | 'findBy'
      | 'findOffers'
      | 'create'
      | 'update'
      | 'delete'
      | 'searchMine'
      | 'searchPublic'
    >
  >;
  let addresses: jest.Mocked<Pick<AddressesService, 'createIfNotExist'>>;

  beforeEach(() => {
    ads = {
      findBy: jest.fn(),
      findOffers: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
      searchMine: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      searchPublic: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    } as never;
    addresses = {
      createIfNotExist: jest
        .fn()
        .mockResolvedValueOnce({ id: 'des1' })
        .mockResolvedValueOnce({ id: 'dep1' }),
    } as never;
    controller = new AdvertisementsController(ads as never, addresses as never);
  });

  describe("getOffers (réservé à l'auteur)", () => {
    it("NotFound si l'annonce n'existe pas", async () => {
      ads.findBy.mockResolvedValue(null as never);
      await expect(controller.getOffers(AUTHOR, AD)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("Forbidden si l'appelant n'est pas l'auteur", async () => {
      ads.findBy.mockResolvedValue({ authorId: 'autre' } as never);
      await expect(controller.getOffers(AUTHOR, AD)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(ads.findOffers).not.toHaveBeenCalled();
    });

    it('auteur : renvoie les offres', async () => {
      ads.findBy.mockResolvedValue({ authorId: AUTHOR } as never);
      await controller.getOffers(AUTHOR, AD);
      expect(ads.findOffers).toHaveBeenCalledWith(AD);
    });
  });

  describe('createDelivery / createShipping', () => {
    it('createDelivery force authorId + type=DELIVERY', async () => {
      await controller.createDelivery(AUTHOR, {
        arrivalDate: '2026-12-01',
        departure: {},
        destination: {},
      } as never);

      const arg = ads.create.mock.calls[0][0];
      expect(arg.type).toBe('DELIVERY');
      expect(arg.authorId).toBe(AUTHOR);
      expect(arg.departureId).toBe('dep1');
      expect(arg.destinationId).toBe('des1');
    });

    it('createShipping force type=SHIPPING', async () => {
      await controller.createShipping(AUTHOR, {
        arrivalDate: '2026-12-01',
        departure: {},
        destination: {},
      } as never);
      expect(ads.create.mock.calls[0][0].type).toBe('SHIPPING');
    });
  });

  describe('update / delete — scoping auteur', () => {
    it('update passe where={id, authorId}', () => {
      controller.update(AUTHOR, { price: 1 } as never, AD);
      expect(ads.update).toHaveBeenCalledWith({
        data: { price: 1 },
        where: { id: AD, authorId: AUTHOR },
      });
    });

    it('delete passe where={id, authorId}', () => {
      controller.delete(AUTHOR, AD);
      expect(ads.delete).toHaveBeenCalledWith({
        where: { id: AD, authorId: AUTHOR },
      });
    });
  });

  describe('getMine — délégation', () => {
    it("transmet l'authorId du token au service (la garde vit dans searchMine)", () => {
      controller.getMine(AUTHOR, { authorId: 'victime' } as never);
      expect(ads.searchMine).toHaveBeenCalledWith(AUTHOR, {
        authorId: 'victime',
      });
    });
  });
});
