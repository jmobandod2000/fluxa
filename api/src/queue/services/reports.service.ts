import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentStatus, TurnStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { i18nMessage } from '../../i18n';

const MAX_DAYS = 93;
const DETAIL_LIMIT = 5000;

const minutes = (from: Date, to: Date) =>
  (to.getTime() - from.getTime()) / 60_000;
const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) =>
  values.length
    ? round1(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
// Percentil 90: "9 de cada 10 esperaron menos de…"
const p90 = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return round1(
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))],
  );
};

interface TurnRow {
  code: string;
  status: TurnStatus;
  serviceDate: string;
  priority: number;
  createdAt: Date;
  calledAt: Date | null;
  finishedAt: Date | null;
  Section: { id: number; name: string; color: string | null };
  Counter: { name: string } | null;
  CalledBy: { id: number; name: string } | null;
}

const summarize = (turns: TurnRow[]) => {
  const waits = turns
    .filter((t) => t.calledAt)
    .map((t) => minutes(t.createdAt, t.calledAt!));
  const services = turns
    .filter((t) => t.status === TurnStatus.DONE && t.calledAt && t.finishedAt)
    .map((t) => minutes(t.calledAt!, t.finishedAt!));
  const count = (status: TurnStatus) =>
    turns.filter((t) => t.status === status).length;
  return {
    issued: turns.length,
    served: count(TurnStatus.DONE),
    noShow: count(TurnStatus.NO_SHOW),
    cancelled: count(TurnStatus.CANCELLED),
    avgWait: average(waits),
    p90Wait: p90(waits),
    avgService: average(services),
  };
};

const groupBy = <K>(items: TurnRow[], key: (item: TurnRow) => K) => {
  const groups = new Map<K, TurnRow[]>();
  for (const item of items)
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prismaService: PrismaService) {}

  async report(from: string, to: string, siteId: number | null) {
    if (from > to)
      throw new BadRequestException(i18nMessage('errors.reportRange'));
    const days =
      (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    if (days > MAX_DAYS)
      throw new BadRequestException(
        i18nMessage('errors.reportTooLong', { days: MAX_DAYS }),
      );

    const siteFilter = siteId === null ? {} : { siteId };
    const [turns, appointments] = await Promise.all([
      this.prismaService.turn.findMany({
        where: { serviceDate: { gte: from, lte: to }, ...siteFilter },
        orderBy: { createdAt: 'asc' },
        select: {
          code: true,
          status: true,
          serviceDate: true,
          priority: true,
          createdAt: true,
          calledAt: true,
          finishedAt: true,
          Section: { select: { id: true, name: true, color: true } },
          Counter: { select: { name: true } },
          CalledBy: { select: { id: true, name: true } },
        },
      }),
      this.prismaService.appointment.groupBy({
        by: ['status'],
        where: {
          startsAt: {
            gte: new Date(`${from}T00:00:00`),
            lt: new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000),
          },
          ...siteFilter,
        },
        _count: true,
      }),
    ]);

    const byDay = [...groupBy(turns, (t) => t.serviceDate).entries()].map(
      ([date, rows]) => ({
        date,
        ...summarize(rows),
      }),
    );

    // Llegadas por hora del día: muestra las horas pico
    const byHour = Array.from({ length: 24 }, (_, hour) => {
      const rows = turns.filter((t) => t.createdAt.getHours() === hour);
      return { hour, issued: rows.length, avgWait: summarize(rows).avgWait };
    });

    const bySection = [...groupBy(turns, (t) => t.Section.id).values()]
      .map((rows) => ({
        section: rows[0].Section.name,
        color: rows[0].Section.color,
        ...summarize(rows),
      }))
      .sort((a, b) => b.issued - a.issued);

    const byStaff = [
      ...groupBy(
        turns.filter((t) => t.CalledBy),
        (t) => t.CalledBy!.id,
      ).values(),
    ]
      .map((rows) => ({ staff: rows[0].CalledBy!.name, ...summarize(rows) }))
      .sort((a, b) => b.served - a.served);

    const appointmentCount = (status: AppointmentStatus) =>
      appointments.find((row) => row.status === status)?._count ?? 0;

    return {
      from,
      to,
      summary: summarize(turns),
      appointments: {
        booked: appointments.reduce((sum, row) => sum + row._count, 0),
        checkedIn: appointmentCount(AppointmentStatus.CHECKED_IN),
        noShow: appointmentCount(AppointmentStatus.NO_SHOW),
        cancelled: appointmentCount(AppointmentStatus.CANCELLED),
      },
      byDay,
      byHour,
      bySection,
      byStaff,
      detail: turns.slice(0, DETAIL_LIMIT).map((t) => ({
        code: t.code,
        date: t.serviceDate,
        section: t.Section.name,
        status: t.status,
        appointment: t.priority > 0,
        createdAt: t.createdAt,
        calledAt: t.calledAt,
        finishedAt: t.finishedAt,
        waitMinutes: t.calledAt
          ? round1(minutes(t.createdAt, t.calledAt))
          : null,
        serviceMinutes:
          t.calledAt && t.finishedAt
            ? round1(minutes(t.calledAt, t.finishedAt))
            : null,
        counter: t.Counter?.name ?? null,
        staff: t.CalledBy?.name ?? null,
      })),
    };
  }
}
