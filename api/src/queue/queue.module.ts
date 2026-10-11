import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { OrganizationModule } from '../organization/organization.module';
import {
  CountersController,
  SectionsController,
} from './controllers/admin.controllers';
import {
  QueueController,
  QueuePublicController,
} from './controllers/queue.controllers';
import {
  AppointmentsController,
  AppointmentsPublicController,
} from './controllers/appointments.controllers';
import { AppointmentsService } from './services/appointments.service';
import { ReportsService } from './services/reports.service';
import {
  CountersService,
  QueueEventsService,
  SectionsService,
  TurnsService,
} from './services';

@Module({
  imports: [
    OrganizationModule,
    // Límite general para las rutas públicas (por IP)
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    SectionsController,
    CountersController,
    QueuePublicController,
    QueueController,
    AppointmentsPublicController,
    AppointmentsController,
  ],
  providers: [
    QueueEventsService,
    SectionsService,
    CountersService,
    TurnsService,
    AppointmentsService,
    ReportsService,
  ],
})
export class QueueModule {}
