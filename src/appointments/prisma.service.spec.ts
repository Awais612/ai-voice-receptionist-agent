import { ApptStatus } from '@prisma/client';

describe('schema enums', () => {
  it('exposes appointment statuses', () => {
    expect(Object.values(ApptStatus)).toContain('booked');
    expect(Object.values(ApptStatus)).toContain('cancelled');
    expect(Object.values(ApptStatus)).toContain('rescheduled');
    expect(Object.values(ApptStatus)).toContain('completed');
  });
});
