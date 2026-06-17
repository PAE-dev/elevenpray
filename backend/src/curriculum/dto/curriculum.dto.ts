import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CurriculumCourseStatus } from '../entities/curriculum-course.entity';

const COLOR_TOKENS = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'indigo', 'teal'] as const;
const STATUSES: CurriculumCourseStatus[] = ['pending', 'in_progress', 'approved', 'failed'];

export class CreateCurriculumCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(99)
  credits?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  cycleNumber: number;

  @IsOptional()
  @IsIn(COLOR_TOKENS)
  colorToken?: (typeof COLOR_TOKENS)[number];

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  prerequisiteIds?: string[];

  @IsOptional()
  @IsIn(STATUSES)
  status?: CurriculumCourseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  approvedGrade?: string;
}

export class UpdateCurriculumCourseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(99)
  credits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  cycleNumber?: number;

  @IsOptional()
  @IsIn(COLOR_TOKENS)
  colorToken?: (typeof COLOR_TOKENS)[number];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: CurriculumCourseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  approvedGrade?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  prerequisiteIds?: string[];
}

export class SetCurriculumStatusDto {
  @IsIn(STATUSES)
  status: CurriculumCourseStatus;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  approvedGrade?: string;
}

export class ReorderCurriculumCoursesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  cycleNumber: number;

  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}

export class BulkImportCurriculumItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  cycleNumber: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credits?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisiteCodes?: string[];
}

export class BulkImportCurriculumDto {
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BulkImportCurriculumItemDto)
  items: BulkImportCurriculumItemDto[];
}
