import { IsUUID, IsOptional, IsEnum, IsString, MaxLength } from "class-validator";

export class GenerateSuggestionsDto {
  @IsUUID()
  personId!: string;

  @IsUUID()
  eventId!: string;

  @IsOptional()
  @IsEnum(["safe", "bold"])
  surpriseFactor?: "safe" | "bold";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  guidanceText?: string;
}

export class SelectSuggestionDto {
  @IsUUID()
  suggestionId!: string;
}

export class DismissSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
