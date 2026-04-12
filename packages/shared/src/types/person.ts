export const RELATIONSHIP_TYPES = [
  "partner",
  "spouse",
  "parent",
  "sibling",
  "child",
  "friend",
  "coworker",
  "boss",
  "other",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface Person {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  birthday: string | null;
  anniversary: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  clothingSizeTop: string | null;
  clothingSizeBottom: string | null;
  shoeSize: string | null;
  musicTaste: string | null;
  favoriteBrands: string | null;
  hobbies: string | null;
  foodPreferences: string | null;
  wishlistUrls: string | null;
  notes: string | null;
  pronouns: string | null;
  allergens: string[];
  dietaryRestrictions: string[];
  dossierInsight: string | null;
  completenessScore: number;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  neverAgainItems: NeverAgainItem[];
  tags?: PersonTag[];
  wishlistItems?: WishlistItem[];
}

export interface NeverAgainItem {
  id: string;
  personId: string;
  description: string;
  createdAt: string;
}

export interface PersonTag {
  id: string;
  personId: string;
  tag: string;
  source: "ai" | "manual";
  createdAt: string;
}

export interface WishlistItem {
  id: string;
  personId: string;
  sourceUrl: string;
  productName: string | null;
  category: string | null;
  brand: string | null;
  priceRange: string | null;
  scrapedAt: string;
  createdAt: string;
}

export const ALLERGEN_OPTIONS = [
  "nuts",
  "dairy",
  "gluten",
  "shellfish",
  "soy",
  "eggs",
  "other",
] as const;

export type AllergenType = (typeof ALLERGEN_OPTIONS)[number];

export const DIETARY_OPTIONS = [
  "vegan",
  "vegetarian",
  "pescatarian",
  "kosher",
  "halal",
  "other",
] as const;

export type DietaryType = (typeof DIETARY_OPTIONS)[number];

export const PRONOUN_OPTIONS = [
  "he/him",
  "she/her",
  "they/them",
] as const;

export interface CreatePersonData {
  name: string;
  relationship: string;
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
  pronouns?: string;
  allergens?: string[];
  dietaryRestrictions?: string[];
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
}
