import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ScheduleBlockDto {
  @ApiProperty({ description: '0 = domingo … 6 = sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ description: 'Minutos desde las 00:00', example: 540 })
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute: number;

  @ApiProperty({ example: 1080 })
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute: number;
}

export class CreateCounterDto {
  @ApiProperty({ example: 'Mostrador 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @ApiProperty({ required: false, description: 'Sucursal; vacío = todas' })
  @IsOptional()
  @IsInt()
  siteId?: number | null;

  @ApiProperty({ type: [Number], description: 'Secciones que atiende' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  sectionIds: number[];

  @ApiProperty({
    required: false,
    type: [ScheduleBlockDto],
    description: 'Horario para citas',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => ScheduleBlockDto)
  schedules?: ScheduleBlockDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCounterDto extends PartialType(CreateCounterDto) {}
