import { Module } from "@nestjs/common";
import { GoogleClientService } from "./google-client.service";
import { AvailabilityService } from "./availability.service";
import { CalendarBookingService } from "./booking.service";

@Module({
  providers: [GoogleClientService, AvailabilityService, CalendarBookingService],
  exports: [GoogleClientService, AvailabilityService, CalendarBookingService],
})
export class CalendarModule {}
