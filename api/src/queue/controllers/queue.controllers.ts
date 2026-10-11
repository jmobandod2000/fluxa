import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Observable, interval, map, merge } from 'rxjs';

import { Auth, GetUser } from '../../auth/decorators';
import { OrganizationService, SitesService } from '../../organization/services';
import { CallNextDto, IssueTurnDto, TransferTurnDto } from '../dtos';
import { QueueEventsService, SectionsService, TurnsService } from '../services';

const HEARTBEAT_MS = 25_000;
const MINUTE = 60_000;

const parseSite = (value?: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Kiosco, pantalla de llamado y seguimiento en el celular: sin sesión, con límite de peticiones por IP
@ApiTags('Queue (public)')
@UseGuards(ThrottlerGuard)
@Controller('queue/public')
export class QueuePublicController {
  constructor(
    private readonly turnsService: TurnsService,
    private readonly sectionsService: SectionsService,
    private readonly sitesService: SitesService,
    private readonly organizationService: OrganizationService,
    private readonly queueEvents: QueueEventsService,
  ) {}

  @Get('config')
  async config() {
    const [organization, sections, sites] = await Promise.all([
      this.organizationService.find(),
      this.sectionsService.findActive(),
      this.sitesService.findAll(),
    ]);
    return {
      name: organization?.name ?? null,
      businessType: organization?.businessType ?? null,
      sections,
      sites: sites
        .filter((site) => site.isActive)
        .map(({ id, code, name }) => ({ id, code, name })),
    };
  }

  @Post('turns')
  @Throttle({ default: { limit: 20, ttl: MINUTE } })
  issue(@Body() dto: IssueTurnDto) {
    return this.turnsService.issue(dto);
  }

  @Get('turns/:token')
  findByToken(@Param('token') token: string) {
    return this.turnsService.findByToken(token);
  }

  @Get('board')
  board(@Query('siteId') siteId?: string) {
    return this.turnsService.board(parseSite(siteId));
  }

  // Eventos en tiempo real; el latido mantiene viva la conexión detrás de proxies
  @Sse('stream')
  @SkipThrottle()
  stream(@Query('siteId') siteId?: string): Observable<MessageEvent> {
    return merge(
      this.queueEvents.stream(parseSite(siteId)),
      interval(HEARTBEAT_MS).pipe(map(() => ({ data: { type: 'ping' } }))),
    );
  }
}

@ApiTags('Queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly turnsService: TurnsService) {}

  @Get('today')
  @Auth()
  today() {
    return this.turnsService.today();
  }

  @Get('counters/:id/state')
  @Auth()
  state(@Param('id', ParseIntPipe) id: number) {
    return this.turnsService.staffState(id);
  }

  @Post('call-next')
  @Auth()
  callNext(@Body() dto: CallNextDto, @GetUser('id') userId: number) {
    return this.turnsService.callNext(dto.counterId, userId);
  }

  @Post('turns/:id/recall')
  @Auth()
  recall(@Param('id', ParseIntPipe) id: number) {
    return this.turnsService.recall(id);
  }

  @Post('turns/:id/finish')
  @Auth()
  finish(@Param('id', ParseIntPipe) id: number) {
    return this.turnsService.finish(id);
  }

  @Post('turns/:id/no-show')
  @Auth()
  noShow(@Param('id', ParseIntPipe) id: number) {
    return this.turnsService.noShow(id);
  }

  @Post('turns/:id/cancel')
  @Auth()
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.turnsService.cancel(id);
  }

  @Post('turns/:id/transfer')
  @Auth()
  transfer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransferTurnDto,
  ) {
    return this.turnsService.transfer(id, dto.sectionId);
  }
}
