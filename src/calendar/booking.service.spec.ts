import { CalendarBookingService } from './booking.service';
import { BusinessConfig } from '../config/business.config';

const insert = jest.fn().mockResolvedValue({ data: { id: 'evt_1' } });
const deleteFn = jest.fn().mockResolvedValue({});
const patch = jest.fn().mockResolvedValue({});

const googleStub = {
  getCalendar: () => ({ events: { insert, delete: deleteFn, patch } }),
  calendarId: 'primary',
} as any;

describe('CalendarBookingService', () => {
  const svc = new CalendarBookingService(googleStub, new BusinessConfig());

  beforeEach(() => jest.clearAllMocks());

  it('creates event with correct title, guest, and returns id', async () => {
    const id = await svc.createEvent({
      name: 'John Smith',
      email: 'j@x.com',
      phone: '555',
      vehicle: 'Toyota Corolla 2018',
      service: 'Brake check',
      date: '2026-06-23',
      time: '10:00',
    });
    expect(id).toBe('evt_1');
    const arg = insert.mock.calls[0][0];
    expect(arg.requestBody.summary).toBe(
      'Brake check — John Smith (Toyota Corolla 2018)',
    );
    expect(arg.requestBody.attendees).toEqual([{ email: 'j@x.com' }]);
    expect(arg.sendUpdates).toBe('all');
  });

  it('deleteEvent calls events.delete with correct params', async () => {
    await svc.deleteEvent('evt_1');
    expect(deleteFn).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_1', sendUpdates: 'all' }),
    );
  });

  it('moveEvent calls events.patch with new times', async () => {
    await svc.moveEvent('evt_1', '2026-06-24', '14:00');
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_1', sendUpdates: 'all' }),
    );
  });
});
