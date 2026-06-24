import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AdminGuard } from './admin.guard';
import { ApptStatus } from '@prisma/client';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('bookings')
  bookings(@Query('status') status?: string) {
    return this.prisma.appointment.findMany({
      where: status ? { status: status as ApptStatus } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('sessions')
  sessions() {
    return this.prisma.callSession.findMany({ orderBy: { startedAt: 'desc' } });
  }

  @Get('sessions/:id')
  session(@Param('id') id: string) {
    return this.prisma.callSession.findUnique({
      where: { id },
      include: { transcript: { orderBy: { timestamp: 'asc' } } },
    });
  }
}
