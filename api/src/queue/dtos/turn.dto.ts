import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IssueTurnDto {
  @ApiProperty()
  @IsInt()
  sectionId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  siteId?: number | null;
}

export class CallNextDto {
  @ApiProperty()
  @IsInt()
  counterId: number;
}

export class TransferTurnDto {
  @ApiProperty()
  @IsInt()
  sectionId: number;
}

export class PresetSectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z]{1,3}$/)
  prefix: string;
}

// Secciones y puesto sugeridos según el tipo de negocio (los textos vienen del front en el idioma del usuario)
export class ApplyPresetDto {
  @ApiProperty({ type: [PresetSectionDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PresetSectionDto)
  sections: PresetSectionDto[];

  @ApiProperty({ example: 'Mostrador 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  counterName: string;
}
