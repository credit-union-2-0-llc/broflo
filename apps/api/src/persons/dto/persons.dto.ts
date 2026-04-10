export class CreatePersonDto {
  name!: string;
  relationship!: string;
  birthday?: string;
  anniversary?: string;
  budgetMinCents?: number;
  budgetMaxCents?: number;
  clothingSizeTop?: string;
  clothingSizeBottom?: string;
  shoeSize?: string;
  musicTaste?: string;
  favoriteBrands?: string;
  hobbies?: string;
  foodPreferences?: string;
  wishlistUrls?: string;
  notes?: string;
}

export class UpdatePersonDto extends CreatePersonDto {}

export class CreateNeverAgainDto {
  description!: string;
}
