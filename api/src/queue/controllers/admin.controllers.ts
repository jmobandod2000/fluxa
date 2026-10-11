import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from '../../auth/decorators';
import { ValidRoles } from '../../auth/interfaces';
import {
  ApplyPresetDto,
  CreateCounterDto,
  CreateSectionDto,
  UpdateCounterDto,
  UpdateSectionDto,
} from '../dtos';
import { CountersService, SectionsService } from '../services';

@ApiTags('Sections')
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  @Auth()
  findAll() {
    return this.sectionsService.findAll();
  }

  @Post()
  @Auth(ValidRoles.ADMIN)
  create(@Body() dto: CreateSectionDto) {
    return this.sectionsService.create(dto);
  }

  @Post('preset')
  @Auth(ValidRoles.ADMIN)
  applyPreset(@Body() dto: ApplyPresetDto) {
    return this.sectionsService.applyPreset(dto);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, dto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sectionsService.remove(id);
  }
}

@ApiTags('Counters')
@Controller('counters')
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  @Get()
  @Auth()
  findAll() {
    return this.countersService.findAll();
  }

  @Post()
  @Auth(ValidRoles.ADMIN)
  create(@Body() dto: CreateCounterDto) {
    return this.countersService.create(dto);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCounterDto) {
    return this.countersService.update(id, dto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.countersService.remove(id);
  }
}
