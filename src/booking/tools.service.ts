import { Injectable } from '@nestjs/common';
import { AvailabilityService } from '../calendar/availability.service';
import {
  CalendarBookingService,
  BookingInput,
} from '../calendar/booking.service';
import { PrismaService } from '../appointments/prisma.service';
import { generateConfirmationCode } from './confirmation-code';

@Injectable()
export class ToolsService {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly calendar: CalendarBookingService,
    private readonly prisma: PrismaService,
  ) {}

  async checkAvailability({ date }: { date: string }) {
    const openSlots = await this.availability.getOpenSlots(date);
    return openSlots.length
      ? { date, openSlots }
      : {
          date,
          openSlots,
          suggestion: 'That day is fully booked — please try another date.',
        };
  }

  async bookAppointment(p: BookingInput) {
    const open = await this.availability.getOpenSlots(p.date);
    if (!open.includes(p.time)) {
      return {
        ok: false,
        error: `Slot ${p.time} on ${p.date} is unavailable. Open slots: ${open.join(', ') || 'none'}.`,
      };
    }
    const googleEventId = await this.calendar.createEvent(p);
    const confirmationCode = generateConfirmationCode();
    await this.prisma.appointment.create({
      data: {
        callerName: p.name,
        email: p.email,
        phone: p.phone,
        vehicle: p.vehicle,
        service: p.service,
        date: p.date,
        time: p.time,
        status: 'booked',
        confirmationCode,
        googleEventId,
      },
    });
    return { ok: true, confirmationCode };
  }

  private findAppt(identifier: string) {
    return this.prisma.appointment.findFirst({
      where: {
        OR: [{ confirmationCode: identifier }, { callerName: identifier }],
        status: { in: ['booked', 'rescheduled'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelAppointment({ identifier }: { identifier: string }) {
    const appt = await this.findAppt(identifier);
    if (!appt)
      return { ok: false, error: 'No matching active appointment found.' };
    await this.calendar.deleteEvent(appt.googleEventId);
    await this.prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'cancelled' },
    });
    return { ok: true };
  }

  async rescheduleAppointment({
    identifier,
    newDate,
    newTime,
  }: {
    identifier: string;
    newDate: string;
    newTime: string;
  }) {
    const appt = await this.findAppt(identifier);
    if (!appt)
      return { ok: false, error: 'No matching active appointment found.' };
    const open = await this.availability.getOpenSlots(newDate);
    if (!open.includes(newTime)) {
      return {
        ok: false,
        error: `Slot ${newTime} on ${newDate} is unavailable. Open slots: ${open.join(', ') || 'none'}.`,
      };
    }
    await this.calendar.moveEvent(appt.googleEventId, newDate, newTime);
    await this.prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'rescheduled', date: newDate, time: newTime },
    });
    return { ok: true };
  }
}
