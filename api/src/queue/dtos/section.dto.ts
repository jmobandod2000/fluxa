import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSectionDto {
  @ApiProperty({ example: 'Carnicería' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ description: 'Letras del número: C → C-015', example: 'C' })
  @IsString()
  @Matches(/^[A-Za-z]{1,3}$/)
  prefix: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string | null;

  @ApiProperty({ required: false, example: '#1A4FD6' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ required: false, description: 'Acepta citas' })
  @IsOptional()
  @IsBoolean()
  bookable?: boolean;

  @ApiProperty({
    required: false,
    description: 'Duración de cada cita (min)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSectionDto extends PartialType(CreateSectionDto) {}
