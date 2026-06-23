import { Injectable } from "@nestjs/common";

@Injectable()
export class BusinessConfig {
  readonly name = "AutoCare Auto Repair";
  readonly persona = "Ava";
  readonly hours = { start: 9, end: 17 } as const;
  readonly days = [1, 2, 3, 4, 5, 6];
  readonly slotMinutes = 60;
  readonly capacity = 2;

  slotTimesForDay(): string[] {
    const out: string[] = [];
    for (let h = this.hours.start; h < this.hours.end; h++) out.push(`${String(h).padStart(2, "0")}:00`);
    return out;
  }
}
