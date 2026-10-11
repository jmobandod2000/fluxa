import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCounterDto extends PartialType(CreateCounterDto) {}
