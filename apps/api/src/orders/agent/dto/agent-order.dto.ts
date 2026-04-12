import { IsString, IsOptional, IsInt, Min, MinLength, MaxLength } from 'class-validator';

export class AgentPreviewDto {
  @IsString()
  suggestionId!: string;

  @IsString()
  personId!: string;

  @IsString()
  eventId!: string;

  @IsOptional()
  @IsString()
  retailerUrl?: string;

  @IsOptional()
  @IsString()
  searchTerms?: string;
}

export class AgentPlaceDto {
  @IsString()
  jobId!: string;
}

export class AgentCancelDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
