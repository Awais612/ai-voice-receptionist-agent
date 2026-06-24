import { Module } from "@nestjs/common";
import { CalendarModule } from "../calendar/calendar.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { ToolsService } from "./tools.service";

@Module({
  imports: [CalendarModule, AppointmentsModule],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class BookingModule {}
