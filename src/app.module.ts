import { Module } from "@nestjs/common";
import { BusinessConfigModule } from "./config/config.module";
import { CalendarModule } from "./calendar/calendar.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { BookingModule } from "./booking/booking.module";
import { ObservabilityModule } from "./observability/observability.module";
import { LiveKitModule } from "./livekit/livekit.module";

@Module({
  imports: [
    BusinessConfigModule,
    CalendarModule,
    AppointmentsModule,
    BookingModule,
    ObservabilityModule,
    LiveKitModule,
  ],
})
export class AppModule {}
