import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { i18nMessage } from '../../i18n';
import { SitesService } from '../../organization/services';
import { CreateCounterDto, UpdateCounterDto } from '../dtos';
import { QueueEventsService } from './queue-events.service';

export const COUNTER_INCLUDE = {
  Sections: {
    where: { isDeleted: false },
    select: { id: true, name: true, prefix: true, color: true },
  },
  Site: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class CountersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sitesService: SitesService,
    private readonly queueEvents: QueueEventsService,
  ) {}

  findAll() {
    return this.prismaService.counter.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
      include: COUNTER_INCLUDE,
    });
  }

  async create(dto: CreateCounterDto) {
    await this.sitesService.assertAssignable(dto.siteId);
    await this.assertSections(dto.sectionIds);
    const counter = await this.prismaService.counter.create({
      data: {
        name: dto.name.trim(),
        siteId: dto.siteId ?? null,
        isActive: dto.isActive ?? true,
        Sections: { connect: dto.sectionIds.map((id) => ({ id })) },
      },
      include: COUNTER_INCLUDE,
    });
    this.queueEvents.emit({ type: 'changed', siteId: counter.siteId });
    return counter;
  }

  async update(id: number, dto: UpdateCounterDto) {
    const current = await this.findActiveOrFail(id);
    if (dto.siteId !== undefined)
      await this.sitesService.assertAssignable(dto.siteId, current.siteId);
    if (dto.sectionIds) await this.assertSections(dto.sectionIds);
    const counter = await this.prismaService.counter.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.siteId !== undefined && { siteId: dto.siteId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sectionIds && {
          Sections: {
            set: dto.sectionIds.map((sectionId) => ({ id: sectionId })),
          },
        }),
      },
      include: COUNTER_INCLUDE,
    });
    this.queueEvents.emit({ type: 'changed', siteId: counter.siteId });
    return counter;
  }

  async remove(id: number) {
    await this.findActiveOrFail(id);
    return this.prismaService.counter.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  }

  async findActiveOrFail(id: number) {
    const counter = await this.prismaService.counter.findFirst({
      where: { id, isDeleted: false },
      include: COUNTER_INCLUDE,
    });
    if (!counter)
      throw new NotFoundException(
        i18nMessage('errors.counterNotFound', { id }),
      );
    return counter;
  }

  private async assertSections(sectionIds: number[]) {
    if (!sectionIds.length) return;
    const found = await this.prismaService.section.count({
      where: { id: { in: sectionIds }, isDeleted: false },
    });
    if (found !== new Set(sectionIds).size)
      throw new BadRequestException(i18nMessage('errors.sectionInvalid'));
  }
}
