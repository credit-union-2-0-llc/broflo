import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from "class-validator";

export class CreateGiftRecordDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsDateString()
  givenAt!: string;
}

export class RecordFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
