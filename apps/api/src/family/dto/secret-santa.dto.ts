import { IsArray, IsInt, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class CreateExchangeDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetCents?: number;
}

export class JoinExchangeDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeUserIds?: string[];
}
