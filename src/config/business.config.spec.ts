import { BusinessConfig } from './business.config';

describe('BusinessConfig', () => {
  const c = new BusinessConfig();
  it('has 2 bays and 1h slots', () => {
    expect(c.capacity).toBe(2);
    expect(c.slotMinutes).toBe(60);
  });
  it('generates hourly slots 09:00..16:00', () => {
    expect(c.slotTimesForDay()).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
    ]);
  });
});
