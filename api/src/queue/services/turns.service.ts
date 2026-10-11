import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Turn, TurnStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { i18nMessage } from '../../i18n';
import { SitesService } from '../../organization/services';
import {
  generatePublicToken,
  TOKEN_FORMAT,
} from '../../common/utils/public-token';
import { IssueTurnDto } from '../dtos';
import { CountersService } from './counters.service';
import { QueueEventsService } from './queue-events.service';
import { SectionsService } from './sections.service';

const BOARD_RECENT = 6;
const WAITING_LIST_MAX = 50;

const TURN_INCLUDE = {
  Section: { select: { id: true, name: true, prefix: true, color: true } },
  Counter: { select: { id: true, name: true } },
} satisfies Prisma.TurnInclude;

type TurnWithRelations = Prisma.TurnGetPayload<{
  include: typeof TURN_INCLUDE;
}>;

// Fecha de servicio en la zona horaria del servidor (TZ): la numeración se reinicia cada día
export const serviceDate = (date = new Date()) =>
  date.toLocaleDateString('en-CA');

const formatCode = (prefix: string, number: number) =>
  `${prefix}-${String(number).padStart(3, '0')}`;

const minutesBetween = (from: Date, to: Date) =>
  (to.getTime() - from.getTime()) / 60000;

@Injectable()
export class TurnsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sitesService: SitesService,
    private readonly sectionsService: SectionsService,
    private readonly countersService: CountersService,
    private readonly queueEvents: QueueEventsService,
  ) {}

  // ---------- público (kiosco, pantalla, celular) ----------

  async issue(dto: IssueTurnDto, appointment?: { id: number }) {
    const section = await this.sectionsService.findAssignable(dto.sectionId);
    const siteId = dto.siteId ?? null;
    await this.sitesService.assertAssignable(siteId);
    const today = serviceDate();

    const turn = await this.prismaService.$transaction(async (tx) => {
      // Un solo emisor por sección a la vez: evita números repetidos con varios kioscos
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${section.id})`;
      const last = await tx.turn.aggregate({
        where: { sectionId: section.id, siteId, serviceDate: today },
        _max: { number: true },
      });
      const number = (last._max.number ?? 0) + 1;
      return tx.turn.create({
        data: {
          number,
          code: formatCode(section.prefix, number),
          serviceDate: today,
          sectionId: section.id,
          siteId,
          publicToken: generatePublicToken(),
          ...(appointment && { priority: 1, appointmentId: appointment.id }),
          // Hora tomada después del bloqueo: el orden de llegada coincide con el número
          createdAt: new Date(),
        },
        include: TURN_INCLUDE,
      });
    });

    this.queueEvents.emit({ type: 'changed', siteId });
    return this.toPublic(turn);
  }

  async findByToken(token: string) {
    if (!TOKEN_FORMAT.test(token))
      throw new NotFoundException(i18nMessage('errors.turnNotFound'));
    const turn = await this.prismaService.turn.findUnique({
      where: { publicToken: token },
      include: TURN_INCLUDE,
    });
    if (!turn) throw new NotFoundException(i18nMessage('errors.turnNotFound'));
    return this.toPublic(turn);
  }

  // Pantalla de llamado: turnos en atención, últimos llamados y cuántos esperan por sección
  async board(siteId: number | null) {
    const today = serviceDate();
    const siteFilter =
      siteId === null ? {} : { OR: [{ siteId }, { siteId: null }] };
    const [called, waiting, sections] = await Promise.all([
      this.prismaService.turn.findMany({
        where: {
          serviceDate: today,
          status: { in: [TurnStatus.CALLED, TurnStatus.DONE] },
          calledAt: { not: null },
          ...siteFilter,
        },
        orderBy: { calledAt: 'desc' },
        take: BOARD_RECENT,
        include: TURN_INCLUDE,
      }),
      this.prismaService.turn.groupBy({
        by: ['sectionId'],
        where: {
          serviceDate: today,
          status: TurnStatus.WAITING,
          ...siteFilter,
        },
        _count: true,
      }),
      this.sectionsService.findActive(),
    ]);

    return {
      called: called.map((turn) => ({
        code: turn.code,
        counter: turn.Counter?.name ?? null,
        section: turn.Section.name,
        color: turn.Section.color,
        status: turn.status,
        calledAt: turn.calledAt,
      })),
      sections: sections.map((section) => ({
        ...section,
        waiting:
          waiting.find((row) => row.sectionId === section.id)?._count ?? 0,
      })),
    };
  }

  // ---------- equipo ----------

  async staffState(counterId: number) {
    const counter = await this.countersService.findActiveOrFail(counterId);
    const today = serviceDate();
    const sectionIds = counter.Sections.map(({ id }) => id);
    const siteFilter =
      counter.siteId === null
        ? {}
        : { OR: [{ siteId: counter.siteId }, { siteId: null }] };

    const [current, waiting, served] = await Promise.all([
      this.prismaService.turn.findFirst({
        where: { counterId, serviceDate: today, status: TurnStatus.CALLED },
        orderBy: { calledAt: 'desc' },
        include: TURN_INCLUDE,
      }),
      this.prismaService.turn.findMany({
        where: {
          serviceDate: today,
          status: TurnStatus.WAITING,
          sectionId: { in: sectionIds },
          ...siteFilter,
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: WAITING_LIST_MAX,
        include: TURN_INCLUDE,
      }),
      this.prismaService.turn.findMany({
        where: { counterId, serviceDate: today, status: TurnStatus.DONE },
        select: { createdAt: true, calledAt: true, finishedAt: true },
      }),
    ]);

    return { counter, current, waiting, stats: this.stats(served) };
  }

  // Resumen del día para el inicio
  async today() {
    const today = serviceDate();
    const turns = await this.prismaService.turn.findMany({
      where: { serviceDate: today },
      select: {
        status: true,
        createdAt: true,
        calledAt: true,
        finishedAt: true,
      },
    });
    const count = (status: TurnStatus) =>
      turns.filter((turn) => turn.status === status).length;
    return {
      issued: turns.length,
      waiting: count(TurnStatus.WAITING),
      inService: count(TurnStatus.CALLED),
      noShow: count(TurnStatus.NO_SHOW),
      ...this.stats(turns.filter((turn) => turn.status === TurnStatus.DONE)),
    };
  }

  // Llamar al siguiente: cierra el turno en curso del puesto y toma el más antiguo de sus secciones
  async callNext(counterId: number, userId: number) {
    const counter = await this.countersService.findActiveOrFail(counterId);
    if (!counter.isActive)
      throw new BadRequestException(
        i18nMessage('errors.counterInactive', { name: counter.name }),
      );
    const sectionIds = counter.Sections.map(({ id }) => id);
    if (!sectionIds.length)
      throw new BadRequestException(
        i18nMessage('errors.counterWithoutSections', { name: counter.name }),
      );
    const today = serviceDate();

    const turn = await this.prismaService.$transaction(async (tx) => {
      await tx.turn.updateMany({
        where: { counterId, serviceDate: today, status: TurnStatus.CALLED },
        data: { status: TurnStatus.DONE, finishedAt: new Date() },
      });
      // SKIP LOCKED: dos puestos que llaman a la vez nunca toman el mismo turno
      const siteClause =
        counter.siteId === null
          ? Prisma.empty
          : Prisma.sql`AND ("siteId" = ${counter.siteId} OR "siteId" IS NULL)`;
      const [next] = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Turn"
        WHERE status = 'WAITING' AND "serviceDate" = ${today}
          AND "sectionId" IN (${Prisma.join(sectionIds)}) ${siteClause}
        ORDER BY priority DESC, "createdAt" ASC, number ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (!next) return null;
      return tx.turn.update({
        where: { id: next.id },
        data: {
          status: TurnStatus.CALLED,
          counterId,
          calledById: userId,
          calledAt: new Date(),
        },
        include: TURN_INCLUDE,
      });
    });

    this.emitCall(turn, counter.siteId);
    return { turn };
  }

  async recall(id: number) {
    const turn = await this.findStaffTurn(id, [TurnStatus.CALLED]);
    const updated = await this.prismaService.turn.update({
      where: { id },
      data: { recallCount: { increment: 1 } },
      include: TURN_INCLUDE,
    });
    this.emitCall(updated, turn.siteId);
    return updated;
  }

  finish(id: number) {
    return this.close(id, TurnStatus.DONE, [TurnStatus.CALLED]);
  }

  noShow(id: number) {
    return this.close(id, TurnStatus.NO_SHOW, [TurnStatus.CALLED]);
  }

  cancel(id: number) {
    return this.close(id, TurnStatus.CANCELLED, [
      TurnStatus.WAITING,
      TurnStatus.CALLED,
    ]);
  }

  // Pasa el turno a otra sección; conserva su número y su hora de llegada
  async transfer(id: number, sectionId: number) {
    const turn = await this.findStaffTurn(id, [
      TurnStatus.WAITING,
      TurnStatus.CALLED,
    ]);
    await this.sectionsService.findAssignable(sectionId);
    const updated = await this.prismaService.turn.update({
      where: { id },
      data: {
        sectionId,
        status: TurnStatus.WAITING,
        counterId: null,
        calledById: null,
        calledAt: null,
      },
      include: TURN_INCLUDE,
    });
    this.queueEvents.emit({ type: 'changed', siteId: turn.siteId });
    return updated;
  }

  // ---------- internos ----------

  private async close(id: number, status: TurnStatus, from: TurnStatus[]) {
    const turn = await this.findStaffTurn(id, from);
    const updated = await this.prismaService.turn.update({
      where: { id },
      data: { status, finishedAt: new Date() },
      include: TURN_INCLUDE,
    });
    this.queueEvents.emit({ type: 'changed', siteId: turn.siteId });
    return updated;
  }

  private async findStaffTurn(
    id: number,
    allowed: TurnStatus[],
  ): Promise<Turn> {
    const turn = await this.prismaService.turn.findUnique({ where: { id } });
    if (!turn) throw new NotFoundException(i18nMessage('errors.turnNotFound'));
    if (!allowed.includes(turn.status))
      throw new BadRequestException(
        i18nMessage('errors.turnInvalidState', { code: turn.code }),
      );
    return turn;
  }

  private emitCall(turn: TurnWithRelations | null, siteId: number | null) {
    if (turn)
      this.queueEvents.emit({
        type: 'called',
        siteId: turn.siteId ?? siteId,
        turn: {
          code: turn.code,
          counter: turn.Counter?.name ?? '',
          section: turn.Section.name,
        },
      });
    else this.queueEvents.emit({ type: 'changed', siteId });
  }

  private stats(
    done: { createdAt: Date; calledAt: Date | null; finishedAt: Date | null }[],
  ) {
    const waits = done
      .filter((t) => t.calledAt)
      .map((t) => minutesBetween(t.createdAt, t.calledAt!));
    const services = done
      .filter((t) => t.calledAt && t.finishedAt)
      .map((t) => minutesBetween(t.calledAt!, t.finishedAt!));
    const average = (values: number[]) =>
      values.length
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
          10
        : null;
    return {
      served: done.length,
      avgWaitMinutes: average(waits),
      avgServiceMinutes: average(services),
    };
  }

  private async toPublic(turn: TurnWithRelations) {
    const ahead =
      turn.status === TurnStatus.WAITING
        ? await this.prismaService.turn.count({
            where: {
              sectionId: turn.sectionId,
              siteId: turn.siteId,
              serviceDate: turn.serviceDate,
              status: TurnStatus.WAITING,
              createdAt: { lt: turn.createdAt },
            },
          })
        : 0;
    return {
      code: turn.code,
      status: turn.status,
      token: turn.publicToken,
      section: turn.Section.name,
      color: turn.Section.color,
      counter: turn.Counter?.name ?? null,
      ahead,
      createdAt: turn.createdAt,
      calledAt: turn.calledAt,
      serviceDate: turn.serviceDate,
    };
  }
}
