import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AppLanguage, i18nMessage, translate } from '../../i18n';
import { MailService } from '../../mail/services';
import { renderEmail } from '../../mail/helpers/email-template.helper';
import { OrganizationService } from '../../organization/services';
import {
  generatePublicToken,
  TOKEN_FORMAT,
} from '../../common/utils/public-token';
import { BookAppointmentDto } from '../dtos/appointment.dto';
import { TurnsService } from './turns.service';

const ACTIVE = [AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN];
const MIN_LEAD_MINUTES = 5;
const REMINDER_EVERY_MS = 5 * 60_000;
const REMINDER_WINDOW_MS = 24 * 3_600_000;
// Las claves de bloqueo de puestos para citas no se cruzan con las de secciones de turnos
const COUNTER_LOCK_OFFSET = 1_000_000;

const APPOINTMENT_INCLUDE = {
  Section: { select: { id: true, name: true, prefix: true, color: true } },
  Counter: { select: { id: true, name: true } },
  Turn: { select: { id: true, code: true, status: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_INCLUDE;
}>;

export interface Slot {
  startsAt: string;
  counters: { id: number; name: string }[];
}

// Día local (zona horaria del servidor) → [inicio, fin)
const dayRange = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start, end, weekday: start.getDay() };
};

const atMinute = (dayStart: Date, minute: number) =>
  new Date(dayStart.getTime() + minute * 60_000);

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;

@Injectable()
export class AppointmentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Appointments');
  private reminderTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly organizationService: OrganizationService,
    private readonly turnsService: TurnsService,
    private readonly mailService: MailService,
  ) {}

  onModuleInit() {
    this.reminderTimer = setInterval(
      () => void this.sendReminders(),
      REMINDER_EVERY_MS,
    );
  }

  onModuleDestroy() {
    clearInterval(this.reminderTimer);
  }

  // ---------- disponibilidad ----------

  async availability(
    sectionId: number,
    date: string,
    counterId: number | null,
    isPublic: boolean,
  ): Promise<Slot[]> {
    const section = await this.findBookableSection(sectionId);
    if (isPublic) await this.assertWithinWindow(date);
    const { start, end, weekday } = dayRange(date);
    const minStart = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);

    const counters = await this.prismaService.counter.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        Sections: { some: { id: section.id } },
        ...(counterId && { id: counterId }),
      },
      include: {
        Schedules: { where: { weekday } },
        Appointments: {
          where: {
            status: { in: ACTIVE },
            startsAt: { lt: end },
            endsAt: { gt: start },
          },
          select: { startsAt: true, endsAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const slots = new Map<number, Slot>();
    for (const counter of counters)
      for (const block of counter.Schedules)
        for (
          let minute = block.startMinute;
          minute + section.durationMinutes <= block.endMinute;
          minute += section.durationMinutes
        ) {
          const slotStart = atMinute(start, minute);
          const slotEnd = atMinute(start, minute + section.durationMinutes);
          if (slotStart < minStart) continue;
          const busy = counter.Appointments.some((item) =>
            overlaps(slotStart, slotEnd, item.startsAt, item.endsAt),
          );
          if (busy) continue;
          const key = slotStart.getTime();
          const slot = slots.get(key) ?? {
            startsAt: slotStart.toISOString(),
            counters: [],
          };
          slot.counters.push({ id: counter.id, name: counter.name });
          slots.set(key, slot);
        }

    return [...slots.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, slot]) => slot);
  }

  // ---------- reservar ----------

  async book(
    dto: BookAppointmentDto,
    options: { isPublic: boolean; language: AppLanguage; userId?: number },
  ) {
    if (dto.website)
      throw new BadRequestException(i18nMessage('errors.appointmentInvalid'));
    const section = await this.findBookableSection(dto.sectionId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(
      startsAt.getTime() + section.durationMinutes * 60_000,
    );
    const date = startsAt.toLocaleDateString('en-CA');
    if (options.isPublic) await this.assertWithinWindow(date);
    if (!dto.customerPhone && !dto.customerEmail && options.isPublic)
      throw new BadRequestException(
        i18nMessage('errors.appointmentContactRequired'),
      );

    // El horario pedido debe ser uno de los ofrecidos (respeta horario y anticipación)
    const slots = await this.availability(
      section.id,
      date,
      dto.counterId ?? null,
      options.isPublic,
    );
    const slot = slots.find((item) => item.startsAt === startsAt.toISOString());
    if (!slot)
      throw new ConflictException(i18nMessage('errors.appointmentSlotTaken'));

    for (const counter of slot.counters) {
      const created = await this.prismaService.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${COUNTER_LOCK_OFFSET + counter.id})`;
        const clash = await tx.appointment.count({
          where: {
            counterId: counter.id,
            status: { in: ACTIVE },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });
        if (clash) return null;
        const { siteId } = await tx.counter.findUniqueOrThrow({
          where: { id: counter.id },
          select: { siteId: true },
        });
        return tx.appointment.create({
          data: {
            sectionId: section.id,
            counterId: counter.id,
            siteId,
            startsAt,
            endsAt,
            customerName: dto.customerName.trim(),
            customerPhone: dto.customerPhone?.trim() || null,
            customerEmail: dto.customerEmail?.trim().toLowerCase() || null,
            notes: dto.notes?.trim() || null,
            publicToken: generatePublicToken(),
            language: options.language,
            createdById: options.userId ?? null,
          },
          include: APPOINTMENT_INCLUDE,
        });
      });
      if (created) {
        void this.sendEmail(created, 'confirmation');
        return this.toPublic(created);
      }
    }
    throw new ConflictException(i18nMessage('errors.appointmentSlotTaken'));
  }

  async findByToken(token: string) {
    return this.toPublic(await this.findTokenOrFail(token));
  }

  async cancelByToken(token: string) {
    const appointment = await this.findTokenOrFail(token);
    if (appointment.status !== AppointmentStatus.BOOKED)
      throw new BadRequestException(
        i18nMessage('errors.appointmentInvalidState'),
      );
    const updated = await this.prismaService.appointment.update({
      where: { id: appointment.id },
      data: { status: AppointmentStatus.CANCELLED },
      include: APPOINTMENT_INCLUDE,
    });
    return this.toPublic(updated);
  }

  // ---------- agenda del equipo ----------

  agenda(date: string) {
    const { start, end } = dayRange(date);
    return this.prismaService.appointment.findMany({
      where: { startsAt: { gte: start, lt: end } },
      orderBy: [{ startsAt: 'asc' }, { counterId: 'asc' }],
      include: APPOINTMENT_INCLUDE,
    });
  }

  // Llegó: entra a la fila de su sección con prioridad
  async checkIn(id: number) {
    const appointment = await this.findStaffOrFail(id, [
      AppointmentStatus.BOOKED,
    ]);
    const turn = await this.turnsService.issue(
      { sectionId: appointment.sectionId, siteId: appointment.siteId },
      { id: appointment.id },
    );
    await this.prismaService.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CHECKED_IN },
    });
    return { turn };
  }

  async setStatus(id: number, status: 'CANCELLED' | 'NO_SHOW') {
    await this.findStaffOrFail(id, [AppointmentStatus.BOOKED]);
    return this.prismaService.appointment.update({
      where: { id },
      data: { status },
      include: APPOINTMENT_INCLUDE,
    });
  }

  // ---------- recordatorios ----------

  private async sendReminders() {
    if (!this.mailService.isConfigured()) return;
    const now = Date.now();
    const due = await this.prismaService.appointment.findMany({
      where: {
        status: AppointmentStatus.BOOKED,
        reminderSentAt: null,
        customerEmail: { not: null },
        startsAt: {
          gt: new Date(now),
          lte: new Date(now + REMINDER_WINDOW_MS),
        },
      },
      include: APPOINTMENT_INCLUDE,
      take: 50,
    });
    for (const appointment of due) {
      // Si se reservó con menos de un día, la confirmación ya sirvió de recordatorio
      const bookedAhead =
        appointment.startsAt.getTime() - appointment.createdAt.getTime();
      if (bookedAhead > REMINDER_WINDOW_MS)
        await this.sendEmail(appointment, 'reminder');
      await this.prismaService.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: new Date() },
      });
    }
  }

  private async sendEmail(
    appointment: AppointmentWithRelations,
    kind: 'confirmation' | 'reminder',
  ) {
    if (!appointment.customerEmail || !this.mailService.isConfigured()) return;
    try {
      const language = appointment.language as AppLanguage;
      const organization = await this.organizationService.find();
      const when = appointment.startsAt.toLocaleString(language, {
        dateStyle: 'full',
        timeStyle: 'short',
      });
      const args = {
        name: appointment.customerName,
        service: appointment.Section.name,
        counter: appointment.Counter.name,
        when,
        business: organization?.name ?? '',
      };
      const { html, text } = renderEmail({
        organizationName: organization?.name ?? '',
        heading: translate(
          language,
          `emails.appointment.${kind}.heading`,
          args,
        ),
        intro: translate(language, `emails.appointment.${kind}.intro`, args),
        ctaLabel: translate(language, 'emails.appointment.cta'),
        ctaUrl: `${this.mailService.appUrl}/#/cita/${appointment.publicToken}`,
        footer: translate(language, 'emails.appointment.footer'),
      });
      await this.mailService.send({
        to: appointment.customerEmail,
        subject: translate(
          language,
          `emails.appointment.${kind}.subject`,
          args,
        ),
        html,
        text,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el correo de la cita ${appointment.id}: ${(error as Error).message}`,
      );
    }
  }

  // ---------- internos ----------

  private async findBookableSection(id: number) {
    const section = await this.prismaService.section.findFirst({
      where: { id, isDeleted: false, isActive: true, bookable: true },
    });
    if (!section)
      throw new NotFoundException(
        i18nMessage('errors.appointmentServiceNotFound'),
      );
    return section;
  }

  private async assertWithinWindow(date: string) {
    const organization = await this.organizationService.find();
    if (!organization?.bookingEnabled)
      throw new BadRequestException(i18nMessage('errors.bookingDisabled'));
    const today = new Date().toLocaleDateString('en-CA');
    const last = new Date(
      Date.now() + organization.bookingDays * 86_400_000,
    ).toLocaleDateString('en-CA');
    if (date < today || date > last)
      throw new BadRequestException(
        i18nMessage('errors.appointmentOutOfWindow', {
          days: organization.bookingDays,
        }),
      );
  }

  private async findTokenOrFail(token: string) {
    if (!TOKEN_FORMAT.test(token))
      throw new NotFoundException(i18nMessage('errors.appointmentNotFound'));
    const appointment = await this.prismaService.appointment.findUnique({
      where: { publicToken: token },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment)
      throw new NotFoundException(i18nMessage('errors.appointmentNotFound'));
    return appointment;
  }

  private async findStaffOrFail(id: number, allowed: AppointmentStatus[]) {
    const appointment = await this.prismaService.appointment.findUnique({
      where: { id },
    });
    if (!appointment)
      throw new NotFoundException(i18nMessage('errors.appointmentNotFound'));
    if (!allowed.includes(appointment.status))
      throw new BadRequestException(
        i18nMessage('errors.appointmentInvalidState'),
      );
    return appointment;
  }

  private toPublic(appointment: AppointmentWithRelations) {
    return {
      token: appointment.publicToken,
      status: appointment.status,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      customerName: appointment.customerName,
      service: appointment.Section.name,
      color: appointment.Section.color,
      counter: appointment.Counter.name,
      turn: appointment.Turn
        ? { code: appointment.Turn.code, status: appointment.Turn.status }
        : null,
    };
  }
}
