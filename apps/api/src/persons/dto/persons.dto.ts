import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  relationship!: string;

  @IsOptional()
  @IsString()
  birthday?: string;

  @IsOptional()
  @IsString()
  anniversary?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMinCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMaxCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  clothingSizeTop?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  clothingSizeBottom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  shoeSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  musicTaste?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  favoriteBrands?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hobbies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  foodPreferences?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  wishlistUrls?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdatePersonDto extends PartialType(CreatePersonDto) {}

export class CreateNeverAgainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;
}
