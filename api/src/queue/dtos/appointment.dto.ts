import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AvailabilityQueryDto {
  @ApiProperty()
  @Matches(/^\d+$/)
  sectionId: string;

  @ApiProperty({ example: '2026-10-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d+$/)
  counterId?: string;
}

export class BookAppointmentDto {
  @ApiProperty()
  @IsInt()
  sectionId: number;

  @ApiProperty({
    required: false,
    description: 'Profesional o puesto elegido; vacío = el primero libre',
  })
  @IsOptional()
  @IsInt()
  counterId?: number | null;

  @ApiProperty({ example: '2026-10-15T14:30:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: 'María Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  customerName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[+\d\s()-]{6,25}$/)
  customerPhone?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  customerEmail?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string | null;

  // Campo trampa: los bots lo llenan, las personas no lo ven
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class AgendaQueryDto {
  @ApiProperty({ example: '2026-10-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;
}
