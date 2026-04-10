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
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  neverAgainItems: NeverAgainItem[];
}

export interface NeverAgainItem {
  id: string;
  personId: string;
  description: string;
  createdAt: string;
}

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
}
