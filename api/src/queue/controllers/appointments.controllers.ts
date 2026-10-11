import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { Auth, GetUser } from '../../auth/decorators';
import { resolveLanguage } from '../../i18n';
import { OrganizationService } from '../../organization/services';
import {
  AgendaQueryDto,
  AvailabilityQueryDto,
  BookAppointmentDto,
} from '../dtos/appointment.dto';
import { AppointmentsService } from '../services/appointments.service';
import { CountersService } from '../services/counters.service';
import { SectionsService } from '../services/sections.service';

const MINUTE = 60_000;

// Reserva pública de citas: sin sesión, con límite por IP
@ApiTags('Appointments (public)')
@UseGuards(ThrottlerGuard)
@Controller('appointments/public')
export class AppointmentsPublicController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly sectionsService: SectionsService,
    private readonly countersService: CountersService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Get('config')
  async config() {
    const [organization, sections, counters] = await Promise.all([
      this.organizationService.find(),
      this.sectionsService.findActive(),
      this.countersService.findAll(),
    ]);
    return {
      name: organization?.name ?? null,
      businessType: organization?.businessType ?? null,
      enabled: organization?.bookingEnabled ?? false,
      bookingDays: organization?.bookingDays ?? 14,
      services: sections
        .filter((section) => section.bookable)
        .map((section) => ({
          ...section,
          counters: counters
            .filter(
              (counter) =>
                counter.isActive &&
                counter.Schedules.length > 0 &&
                counter.Sections.some(({ id }) => id === section.id),
            )
            .map(({ id, name }) => ({ id, name })),
        })),
    };
  }

  @Get('availability')
  availability(@Query() query: AvailabilityQueryDto) {
    return this.appointmentsService.availability(
      Number(query.sectionId),
      query.date,
      query.counterId ? Number(query.counterId) : null,
      true,
    );
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 10 * MINUTE } })
  book(@Body() dto: BookAppointmentDto, @Headers('x-lang') lang?: string) {
    return this.appointmentsService.book(dto, {
      isPublic: true,
      language: resolveLanguage(lang),
    });
  }

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.appointmentsService.findByToken(token);
  }

  @Post(':token/cancel')
  @Throttle({ default: { limit: 10, ttl: 10 * MINUTE } })
  cancel(@Param('token') token: string) {
    return this.appointmentsService.cancelByToken(token);
  }
}

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @Auth()
  agenda(@Query() query: AgendaQueryDto) {
    return this.appointmentsService.agenda(query.date);
  }

  @Get('availability')
  @Auth()
  availability(@Query() query: AvailabilityQueryDto) {
    return this.appointmentsService.availability(
      Number(query.sectionId),
      query.date,
      query.counterId ? Number(query.counterId) : null,
      false,
    );
  }

  @Post()
  @Auth()
  create(
    @Body() dto: BookAppointmentDto,
    @GetUser('id') userId: number,
    @Headers('x-lang') lang?: string,
  ) {
    return this.appointmentsService.book(dto, {
      isPublic: false,
      language: resolveLanguage(lang),
      userId,
    });
  }

  @Post(':id/check-in')
  @Auth()
  checkIn(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.checkIn(id);
  }

  @Post(':id/cancel')
  @Auth()
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.setStatus(id, 'CANCELLED');
  }

  @Post(':id/no-show')
  @Auth()
  noShow(@Param('id', ParseIntPipe) id: number) {
    return this.appointmentsService.setStatus(id, 'NO_SHOW');
  }
}
