import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class PreviewOrderDto {
  @IsString()
  suggestionId!: string;

  @IsString()
  personId!: string;

  @IsString()
  eventId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMaxCents?: number;
}
