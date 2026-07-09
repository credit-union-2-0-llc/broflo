import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

const ALLERGEN_OPTIONS = ["nuts", "dairy", "gluten", "shellfish", "soy", "eggs", "other"] as const;
const DIETARY_OPTIONS = ["vegan", "vegetarian", "pescatarian", "kosher", "halal", "other"] as const;

// Every field a recipient can self-report, mirroring CreatePersonDto's
// optional fields — deliberately excludes shipping address. A recipient
// filling in their own home address through a novelty link is more risk
// than value; that's a separate, explicit ask if the giver needs it.
export class SendSurveyDto {
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;
}

export class SubmitSurveyDto {
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
}

export const SURVEY_FIELD_KEYS = [
  "birthday",
  "anniversary",
  "budgetMinCents",
  "budgetMaxCents",
  "clothingSizeTop",
  "clothingSizeBottom",
  "shoeSize",
  "musicTaste",
  "favoriteBrands",
  "hobbies",
  "foodPreferences",
  "wishlistUrls",
  "notes",
  "pronouns",
  "allergens",
  "dietaryRestrictions",
] as const;

export class ReviewSurveyResponseDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(SURVEY_FIELD_KEYS, { each: true })
  fields?: string[];

  @IsOptional()
  @IsIn(["accept", "dismiss"])
  action?: "accept" | "dismiss";
}
