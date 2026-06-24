import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  controllers: [AdminController],
  providers: [PrismaService, AdminGuard],
  exports: [PrismaService],
})
export class AppointmentsModule {}
