import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { i18nMessage } from '../../i18n';
import { ApplyPresetDto, CreateSectionDto, UpdateSectionDto } from '../dtos';
import { QueueEventsService } from './queue-events.service';

const emptyToNull = (value?: string | null) => value?.trim() || null;

@Injectable()
export class SectionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueEvents: QueueEventsService,
  ) {}

  findAll() {
    return this.prismaService.section.findMany({
      where: { isDeleted: false },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findActive() {
    return this.prismaService.section.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        prefix: true,
        description: true,
        color: true,
      },
    });
  }

  async create(dto: CreateSectionDto) {
    const prefix = dto.prefix.toUpperCase();
    await this.assertUnique(dto.name.trim(), prefix);
    const section = await this.prismaService.section.create({
      data: {
        name: dto.name.trim(),
        prefix,
        description: emptyToNull(dto.description),
        color: dto.color ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    this.queueEvents.emit({ type: 'changed', siteId: null });
    return section;
  }

  async update(id: number, dto: UpdateSectionDto) {
    await this.findOrFail(id);
    const prefix = dto.prefix?.toUpperCase();
    await this.assertUnique(dto.name?.trim(), prefix, id);
    const section = await this.prismaService.section.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(prefix && { prefix }),
        ...(dto.description !== undefined && {
          description: emptyToNull(dto.description),
        }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    this.queueEvents.emit({ type: 'changed', siteId: null });
    return section;
  }

  async remove(id: number) {
    await this.findOrFail(id);
    const section = await this.prismaService.section.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
    this.queueEvents.emit({ type: 'changed', siteId: null });
    return section;
  }

  // Asistente inicial: crea las secciones sugeridas y un puesto que las atiende todas (solo si aún no hay secciones)
  async applyPreset(dto: ApplyPresetDto) {
    const existing = await this.prismaService.section.count({
      where: { isDeleted: false },
    });
    if (existing > 0) return this.findAll();

    await this.prismaService.$transaction(async (tx) => {
      const sections = [];
      for (const [index, item] of dto.sections.entries())
        sections.push(
          await tx.section.create({
            data: {
              name: item.name.trim(),
              prefix: item.prefix.toUpperCase(),
              sortOrder: index,
            },
          }),
        );
      const counters = await tx.counter.count({ where: { isDeleted: false } });
      if (!counters)
        await tx.counter.create({
          data: {
            name: dto.counterName.trim(),
            Sections: { connect: sections.map(({ id }) => ({ id })) },
          },
        });
    });
    this.queueEvents.emit({ type: 'changed', siteId: null });
    return this.findAll();
  }

  async findAssignable(id: number) {
    const section = await this.prismaService.section.findFirst({
      where: { id, isDeleted: false },
    });
    if (!section)
      throw new NotFoundException(
        i18nMessage('errors.sectionNotFound', { id }),
      );
    if (!section.isActive)
      throw new BadRequestException(
        i18nMessage('errors.sectionInactive', { name: section.name }),
      );
    return section;
  }

  private async findOrFail(id: number) {
    const section = await this.prismaService.section.findFirst({
      where: { id, isDeleted: false },
    });
    if (!section)
      throw new NotFoundException(
        i18nMessage('errors.sectionNotFound', { id }),
      );
    return section;
  }

  private async assertUnique(
    name?: string,
    prefix?: string,
    exceptId?: number,
  ) {
    if (!name && !prefix) return;
    const duplicate = await this.prismaService.section.findFirst({
      where: {
        isDeleted: false,
        ...(exceptId && { id: { not: exceptId } }),
        OR: [
          ...(name
            ? [{ name: { equals: name, mode: 'insensitive' as const } }]
            : []),
          ...(prefix ? [{ prefix }] : []),
        ],
      },
    });
    if (!duplicate) return;
    if (prefix && duplicate.prefix === prefix)
      throw new BadRequestException(
        i18nMessage('errors.sectionPrefixDuplicate', { prefix }),
      );
    throw new BadRequestException(
      i18nMessage('errors.sectionDuplicate', { name }),
    );
  }
}
