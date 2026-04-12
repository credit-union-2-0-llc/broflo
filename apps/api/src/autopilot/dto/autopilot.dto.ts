import { IsString, IsInt, IsBoolean, IsOptional, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAutopilotRuleDto {
  @IsString()
  personId!: string;

  @IsArray()
  @IsString({ each: true })
  occasionTypes!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(500)
  budgetMinCents!: number;

  @Type(() => Number)
  @IsInt()
  @Min(500)
  budgetMaxCents!: number;

  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(200000) // $2,000 platform hard cap
  monthlyCapCents!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  leadDays?: number;

  @IsBoolean()
  consentGiven!: boolean;
}

export class UpdateAutopilotRuleDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  occasionTypes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  budgetMinCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  budgetMaxCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(200000)
  monthlyCapCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  leadDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListAutopilotRunsDto {
  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
