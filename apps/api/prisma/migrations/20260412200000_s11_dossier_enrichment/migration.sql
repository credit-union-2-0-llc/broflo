-- S-11: Dossier Enrichment
-- Adds person enrichment fields, person_tags table, wishlist_items table

-- New columns on persons table (all nullable or with defaults)
ALTER TABLE "persons" ADD COLUMN "pronouns" VARCHAR(50);
ALTER TABLE "persons" ADD COLUMN "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "persons" ADD COLUMN "dietary_restrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "persons" ADD COLUMN "dossier_insight" VARCHAR(2000);
ALTER TABLE "persons" ADD COLUMN "completeness_score" INTEGER NOT NULL DEFAULT 0;

-- Shipping address columns on persons (new in S-11)
ALTER TABLE "persons" ADD COLUMN "shipping_address1" TEXT;
ALTER TABLE "persons" ADD COLUMN "shipping_address2" TEXT;
ALTER TABLE "persons" ADD COLUMN "shipping_city" TEXT;
ALTER TABLE "persons" ADD COLUMN "shipping_state" TEXT;
ALTER TABLE "persons" ADD COLUMN "shipping_zip" TEXT;

-- PersonTag table
CREATE TABLE "person_tags" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "tag" VARCHAR(100) NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'ai',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_tags_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one tag text per person
CREATE UNIQUE INDEX "uq_person_tag" ON "person_tags"("person_id", "tag");

-- Index for lookups by person
CREATE INDEX "idx_person_tags_person" ON "person_tags"("person_id");

-- FK to persons
ALTER TABLE "person_tags" ADD CONSTRAINT "person_tags_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WishlistItem table
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "source_url" VARCHAR(2000) NOT NULL,
    "product_name" VARCHAR(500),
    "category" VARCHAR(200),
    "brand" VARCHAR(200),
    "price_range" VARCHAR(100),
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- Index for lookups by person
CREATE INDEX "idx_wishlist_items_person" ON "wishlist_items"("person_id");

-- FK to persons
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
