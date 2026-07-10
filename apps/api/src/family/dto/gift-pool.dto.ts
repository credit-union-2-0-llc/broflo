import { IsInt, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class CreatePoolDto {
  @IsString()
  @MaxLength(100)
  title!: string;

  @IsInt()
  @Min(1)
  targetCents!: number;
}

export class ContributeDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
