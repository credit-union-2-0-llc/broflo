import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export enum OccasionTypeDto {
  birthday = "birthday",
  anniversary = "anniversary",
  holiday = "holiday",
  graduation = "graduation",
  promotion = "promotion",
  custom = "custom",
}

export enum RecurrenceRuleDto {
  annual = "annual",
  one_time = "one_time",
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty({ message: "Event name is required" })
  @MaxLength(100, { message: "Event name must be 100 characters or fewer" })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: "Event date is required" })
  date!: string;

  @IsEnum(OccasionTypeDto, { message: "Invalid occasion type" })
  occasionType!: OccasionTypeDto;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsEnum(RecurrenceRuleDto, { message: "Invalid recurrence rule" })
  recurrenceRule?: RecurrenceRuleDto;

  @IsOptional()
  @IsInt({ message: "Budget minimum must be an integer" })
  @Min(0, { message: "Budget minimum must be zero or greater" })
  budgetMinCents?: number;

  @IsOptional()
  @IsInt({ message: "Budget maximum must be an integer" })
  @Min(0, { message: "Budget maximum must be zero or greater" })
  budgetMaxCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Notes must be 500 characters or fewer" })
  notes?: string;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}
