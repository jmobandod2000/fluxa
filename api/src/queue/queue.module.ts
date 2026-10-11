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
  ],
  providers: [
    QueueEventsService,
    SectionsService,
    CountersService,
    TurnsService,
  ],
})
export class QueueModule {}
