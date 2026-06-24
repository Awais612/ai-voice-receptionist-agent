import { Injectable } from '@nestjs/common';
import { GoogleClientService } from './google-client.service';
import { BusinessConfig } from '../config/business.config';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly google: GoogleClientService,
    private readonly cfg: BusinessConfig,
  ) {}

  isBusinessDay(date: string): boolean {
    return this.cfg.days.includes(new Date(`${date}T12:00:00`).getDay());
  }

  async getOpenSlots(date: string): Promise<string[]> {
    if (!this.isBusinessDay(date)) return [];
    const res = await this.google.getCalendar().events.list({
      calendarId: this.google.calendarId,
      timeMin: `${date}T00:00:00Z`,
      timeMax: `${date}T23:59:59Z`,
      singleEvents: true,
    });
    const events = (res.data.items ?? []).map((e) => ({
      start: new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00`),
      end: new Date(e.end?.dateTime ?? `${e.end?.date}T23:59:59`),
    }));
    return this.cfg.slotTimesForDay().filter((time) => {
      const s = new Date(`${date}T${time}:00Z`);
      const en = new Date(s.getTime() + this.cfg.slotMinutes * 60000);
      const overlapping = events.filter(
        (ev) => ev.start < en && ev.end > s,
      ).length;
      return overlapping < this.cfg.capacity;
    });
  }
}
