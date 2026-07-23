import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

// Unité pure : DatabaseService + EventEmitter mockés. Verrouille les gardes
// (404 / plus PENDING / non-participant / auteur) et le verrou optimiste.

const makeDb = () => ({
  messageAppointment: {
    findUnique: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
});

const pendingAppointment = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  status: 'PENDING',
  message: {
    authorId: 'shipper',
    conversationId: 'c1',
    conversation: { shipperId: 'shipper', carrierId: 'carrier' },
  },
  ...over,
});

describe('AppointmentsService', () => {
  let db: ReturnType<typeof makeDb>;
  let emitter: { emit: jest.Mock };
  let service: AppointmentsService;
  const accept = { status: 'ACCEPTED' } as never;

  beforeEach(() => {
    db = makeDb();
    emitter = { emit: jest.fn() };
    service = new AppointmentsService(db as never, emitter as never);
  });

  it("lève NotFound si le RDV n'existe pas", async () => {
    db.messageAppointment.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('a1', 'carrier', accept),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.messageAppointment.updateMany).not.toHaveBeenCalled();
  });

  it("lève BadRequest si le RDV n'est plus PENDING", async () => {
    db.messageAppointment.findUnique.mockResolvedValue(
      pendingAppointment({ status: 'ACCEPTED' }),
    );

    await expect(
      service.updateStatus('a1', 'carrier', accept),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lève Forbidden si le user n'est pas participant de la conversation", async () => {
    db.messageAppointment.findUnique.mockResolvedValue(pendingAppointment());

    await expect(
      service.updateStatus('a1', 'intrus', accept),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lève Forbidden si l'auteur décide de son propre RDV", async () => {
    db.messageAppointment.findUnique.mockResolvedValue(pendingAppointment());

    await expect(
      service.updateStatus('a1', 'shipper', accept),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.messageAppointment.updateMany).not.toHaveBeenCalled();
  });

  it('happy : verrou optimiste (WHERE PENDING) + event appointment.updated', async () => {
    db.messageAppointment.findUnique
      .mockResolvedValueOnce(pendingAppointment())
      .mockResolvedValueOnce({ id: 'a1', status: 'ACCEPTED' });

    const res = await service.updateStatus('a1', 'carrier', accept);

    expect(db.messageAppointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', status: 'PENDING' },
      data: { status: 'ACCEPTED' },
    });
    expect(emitter.emit).toHaveBeenCalledWith('appointment.updated', {
      appointment: { id: 'a1', status: 'ACCEPTED' },
      conversationId: 'c1',
    });
    expect(res).toEqual({ id: 'a1', status: 'ACCEPTED' });
  });

  it('course entre deux décisions (count 0) → BadRequest, pas d’event', async () => {
    db.messageAppointment.findUnique.mockResolvedValue(pendingAppointment());
    db.messageAppointment.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateStatus('a1', 'carrier', accept),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
