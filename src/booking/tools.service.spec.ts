import { ToolsService } from './tools.service';

const getOpenSlots = jest.fn();
const createEvent = jest.fn();
const deleteEvent = jest.fn();
const moveEvent = jest.fn();
const create = jest.fn();
const findFirst = jest.fn();
const update = jest.fn();

const availStub = { getOpenSlots } as any;
const bookingStub = { createEvent, deleteEvent, moveEvent } as any;
const prismaStub = { appointment: { create, findFirst, update } } as any;

describe('ToolsService', () => {
  const svc = new ToolsService(availStub, bookingStub, prismaStub);
  const input = {
    name: 'J',
    email: 'j@x.com',
    phone: '5',
    vehicle: 'v',
    service: 's',
    date: '2026-06-23',
    time: '10:00',
  };

  beforeEach(() => jest.clearAllMocks());

  describe('bookAppointment', () => {
    it('rejects when slot is not open', async () => {
      getOpenSlots.mockResolvedValue(['09:00']);
      const r = await svc.bookAppointment(input);
      expect(r.ok).toBe(false);
      expect(createEvent).not.toHaveBeenCalled();
    });

    it('books and persists when slot is open', async () => {
      getOpenSlots.mockResolvedValue(['10:00']);
      createEvent.mockResolvedValue('evt_1');
      const r = await svc.bookAppointment(input);
      expect(r.ok).toBe(true);
      expect(r.confirmationCode).toMatch(/^AC-\d{4}$/);
      expect(create).toHaveBeenCalled();
    });
  });

  describe('cancelAppointment', () => {
    it('returns error when appointment not found', async () => {
      findFirst.mockResolvedValue(null);
      const r = await svc.cancelAppointment({ identifier: 'AC-9999' });
      expect(r.ok).toBe(false);
    });

    it('cancels and deletes event when found', async () => {
      findFirst.mockResolvedValue({ id: 'appt_1', googleEventId: 'evt_1' });
      const r = await svc.cancelAppointment({ identifier: 'AC-1234' });
      expect(r.ok).toBe(true);
      expect(deleteEvent).toHaveBeenCalledWith('evt_1');
      expect(update).toHaveBeenCalled();
    });
  });

  describe('rescheduleAppointment', () => {
    it('rejects when new slot is full', async () => {
      findFirst.mockResolvedValue({ id: 'appt_1', googleEventId: 'evt_1' });
      getOpenSlots.mockResolvedValue(['09:00']);
      const r = await svc.rescheduleAppointment({
        identifier: 'AC-1234',
        newDate: '2026-06-24',
        newTime: '10:00',
      });
      expect(r.ok).toBe(false);
    });

    it('reschedules when new slot is open', async () => {
      findFirst.mockResolvedValue({ id: 'appt_1', googleEventId: 'evt_1' });
      getOpenSlots.mockResolvedValue(['10:00']);
      const r = await svc.rescheduleAppointment({
        identifier: 'AC-1234',
        newDate: '2026-06-24',
        newTime: '10:00',
      });
      expect(r.ok).toBe(true);
      expect(moveEvent).toHaveBeenCalledWith('evt_1', '2026-06-24', '10:00');
    });
  });
});
