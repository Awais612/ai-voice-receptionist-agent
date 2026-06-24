import { Injectable } from '@nestjs/common';
import { GoogleClientService } from './google-client.service';
import { BusinessConfig } from '../config/business.config';

export interface BookingInput {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  service: string;
  date: string;
  time: string;
}

@Injectable()
export class CalendarBookingService {
  constructor(
    private readonly google: GoogleClientService,
    private readonly cfg: BusinessConfig,
  ) {}

  private range(date: string, time: string) {
    const start = new Date(`${date}T${time}:00Z`);
    const end = new Date(start.getTime() + this.cfg.slotMinutes * 60000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async createEvent(p: BookingInput): Promise<string> {
    const { start, end } = this.range(p.date, p.time);
    const res = await this.google.getCalendar().events.insert({
      calendarId: this.google.calendarId,
      sendUpdates: 'all',
      requestBody: {
        summary: `${p.service} — ${p.name} (${p.vehicle})`,
        description: `Phone: ${p.phone}\nVehicle: ${p.vehicle}\nService: ${p.service}`,
        start: { dateTime: start },
        end: { dateTime: end },
        attendees: [{ email: p.email }],
      },
    });
    return res.data.id!;
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.google.getCalendar().events.delete({
      calendarId: this.google.calendarId,
      eventId,
      sendUpdates: 'all',
    });
  }

  async moveEvent(eventId: string, date: string, time: string): Promise<void> {
    const { start, end } = this.range(date, time);
    await this.google.getCalendar().events.patch({
      calendarId: this.google.calendarId,
      eventId,
      sendUpdates: 'all',
      requestBody: { start: { dateTime: start }, end: { dateTime: end } },
    });
  }
}
