import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

const ALLERGEN_OPTIONS = ["nuts", "dairy", "gluten", "shellfish", "soy", "eggs", "other"] as const;
const DIETARY_OPTIONS = ["vegan", "vegetarian", "pescatarian", "kosher", "halal", "other"] as const;

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

  @IsOptional()
  @IsString()
  @MaxLength(50)
  pronouns?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(ALLERGEN_OPTIONS, { each: true })
  allergens?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(DIETARY_OPTIONS, { each: true })
  dietaryRestrictions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shippingAddress1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shippingAddress2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, { message: "State must be a 2-letter abbreviation" })
  shippingState?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}(-\d{4})?$/, { message: "Zip must be 5 digits or 5+4 format" })
  shippingZip?: string;
}

export class UpdatePersonDto extends PartialType(CreatePersonDto) {}

export class CreateNeverAgainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;
}
