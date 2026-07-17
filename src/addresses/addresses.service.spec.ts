import { AddressesService } from './addresses.service';

// Unité pure : DatabaseService mocké.
// $executeRaw / $queryRaw sont utilisés par setLocation (PostGIS) → mocks no-op.

const makeDb = () => ({
  address: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  city: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  $executeRaw: jest.fn().mockResolvedValue(undefined),
  $queryRaw: jest.fn().mockResolvedValue(undefined),
});

const prismaErr = (code: string) => Object.assign(new Error(code), { code });

describe('AddressesService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: AddressesService;

  beforeEach(() => {
    db = makeDb();
    service = new AddressesService(db as never);
  });

  describe('createCityIfNotExist', () => {
    it('upsert sur la clé unique name_countryIsoCode et renvoie le résultat', async () => {
      const city = {
        id: 'c1',
        name: 'Dakar',
        country: 'Senegal',
        countryIsoCode: 'SN',
      };
      db.city.upsert.mockResolvedValue(city);

      const res = await service.createCityIfNotExist({
        name: 'Dakar',
        country: 'Senegal',
        countryIsoCode: 'SN',
      } as never);

      expect(db.city.upsert).toHaveBeenCalledWith({
        where: {
          name_countryIsoCode: { name: 'Dakar', countryIsoCode: 'SN' },
        },
        create: { name: 'Dakar', country: 'Senegal', countryIsoCode: 'SN' },
        update: {},
      });
      expect(res).toBe(city);
    });
  });

  describe('createIfNotExist', () => {
    const baseData = {
      country: 'Senegal',
      countryIsoCode: 'SN',
      city: 'Dakar',
      street: 'Rue 10',
      zipCode: '10000',
    };

    beforeEach(() => {
      db.city.upsert.mockResolvedValue({ id: 'cityId-1' });
    });

    it('dédup par coordonnées : si une adresse existe déjà (findFirst) → ne recrée pas, renvoie l’existante', async () => {
      const existing = { id: 'addr-existing' };
      db.address.findFirst.mockResolvedValue(existing);

      const res = await service.createIfNotExist({
        ...baseData,
        latitude: 14.7167,
        longitude: -17.4677,
      } as never);

      expect(res).toBe(existing);
      expect(db.address.findFirst).toHaveBeenCalledTimes(1);
      // where de dédup basé sur les coordonnées (arrondies à 6 décimales)
      const arg = db.address.findFirst.mock.calls[0][0];
      expect(arg.where).toHaveProperty('latitude');
      expect(arg.where).toHaveProperty('longitude');
      expect(String(arg.where.latitude)).toBe('14.7167');
      expect(String(arg.where.longitude)).toBe('-17.4677');
      expect(db.address.create).not.toHaveBeenCalled();
      expect(db.$executeRaw).not.toHaveBeenCalled();
    });

    it('création + setLocation quand des coordonnées sont fournies et aucune adresse existante', async () => {
      db.address.findFirst.mockResolvedValue(null);
      db.address.create.mockResolvedValue({ id: 'new-addr' });

      const res = await service.createIfNotExist({
        ...baseData,
        latitude: 14.7167,
        longitude: -17.4677,
      } as never);

      expect(db.address.create).toHaveBeenCalledTimes(1);
      const createArg = db.address.create.mock.calls[0][0];
      // cityId provient du upsert, country/countryIsoCode/city retirés du data address
      expect(createArg.data.cityId).toBe('cityId-1');
      expect(createArg.data).not.toHaveProperty('country');
      expect(createArg.data).not.toHaveProperty('city');
      // setLocation → $executeRaw appelé
      expect(db.$executeRaw).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ id: 'new-addr' });
    });

    it('dédup textuelle par ville+rue+zip quand pas de coordonnées', async () => {
      db.address.findFirst.mockResolvedValue(null);
      db.address.create.mockResolvedValue({ id: 'new-addr' });

      await service.createIfNotExist({ ...baseData } as never);

      const arg = db.address.findFirst.mock.calls[0][0];
      expect(arg.where).toEqual({
        cityId: 'cityId-1',
        street: 'Rue 10',
        zipCode: '10000',
      });
      // pas de coordonnées → pas de setLocation
      expect(db.$executeRaw).not.toHaveBeenCalled();
    });

    it('« ville seule » sans rue ni coordonnées ne déduplique pas → crée directement sans findFirst', async () => {
      db.address.create.mockResolvedValue({ id: 'new-addr' });

      await service.createIfNotExist({
        country: 'Senegal',
        countryIsoCode: 'SN',
        city: 'Dakar',
      } as never);

      // dedupWhere renvoie null → aucun findFirst de dédup
      expect(db.address.findFirst).not.toHaveBeenCalled();
      expect(db.address.create).toHaveBeenCalledTimes(1);
      expect(db.$executeRaw).not.toHaveBeenCalled();
    });

    it('conflit P2002 à la création → retombe sur findFirst(where) et renvoie l’existant', async () => {
      db.address.findFirst
        .mockResolvedValueOnce(null) // pré-check de dédup
        .mockResolvedValueOnce({ id: 'addr-conflict' }); // relecture après P2002
      db.address.create.mockRejectedValue(prismaErr('P2002'));

      const res = await service.createIfNotExist({ ...baseData } as never);

      expect(db.address.findFirst).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ id: 'addr-conflict' });
    });
  });

  describe('findCities', () => {
    it('sans filtre → where vide', async () => {
      db.city.findMany.mockResolvedValue([]);

      await service.findCities();

      expect(db.city.findMany).toHaveBeenCalledWith({
        where: {},
        take: 20,
        orderBy: { name: 'asc' },
      });
    });

    it('filtre par search et country (contains, insensitive)', async () => {
      db.city.findMany.mockResolvedValue([{ id: 'c1' }]);

      const res = await service.findCities('dak', 'sen');

      expect(db.city.findMany).toHaveBeenCalledWith({
        where: {
          name: { contains: 'dak', mode: 'insensitive' },
          country: { contains: 'sen', mode: 'insensitive' },
        },
        take: 20,
        orderBy: { name: 'asc' },
      });
      expect(res).toEqual([{ id: 'c1' }]);
    });
  });
});
