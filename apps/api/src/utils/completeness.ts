export interface CompletenessData {
  hobbies?: string | null;
  favoriteBrands?: string | null;
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
  foodPreferences?: string | null;
  birthday?: Date | string | null;
  shippingAddress1?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  musicTaste?: string | null;
  clothingSizeTop?: string | null;
  clothingSizeBottom?: string | null;
  allergens?: string[];
  shoeSize?: string | null;
  wishlistUrls?: string | null;
  notes?: string | null;
  anniversary?: Date | string | null;
}

export function computeCompleteness(data: CompletenessData, photoCount = 0): number {
  let score = 0;
  if (data.hobbies) score += 15;
  if (data.favoriteBrands) score += 12;
  if (data.budgetMinCents || data.budgetMaxCents) score += 12;
  if (data.foodPreferences) score += 10;
  if (data.birthday) score += 10;
  if (data.shippingAddress1 && data.shippingCity && data.shippingState && data.shippingZip) score += 10;
  if (data.musicTaste) score += 7;
  if (data.clothingSizeTop || data.clothingSizeBottom) score += 6;
  if (Array.isArray(data.allergens) && data.allergens.length > 0) score += 5;
  if (data.shoeSize) score += 3;
  if (data.wishlistUrls) score += 5;
  if (data.notes) score += 3;
  if (data.anniversary) score += 2;
  if (photoCount > 0) score += 8;
  return Math.min(score, 100);
}
