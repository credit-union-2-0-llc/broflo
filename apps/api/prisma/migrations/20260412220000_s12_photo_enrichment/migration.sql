-- S-12: Photo Dossier Enrichment

-- CreateEnum
CREATE TYPE "photo_category" AS ENUM (
  'bookshelf', 'closet', 'artwork', 'desk', 'kitchen',
  'bar_cart', 'shoes', 'jewelry', 'nightstand', 'garage',
  'garden', 'gaming_music', 'pet_area', 'fridge', 'car',
  'social_ig_fb', 'social_spotify', 'social_amazon', 'other'
);

CREATE TYPE "photo_analysis_status" AS ENUM (
  'pending', 'processing', 'complete', 'failed'
);

-- CreateTable
CREATE TABLE "person_photos" (
  "id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "blob_path" VARCHAR(2000) NOT NULL,
  "thumb_blob_path" VARCHAR(2000),
  "category" "photo_category" NOT NULL DEFAULT 'other',
  "mime_type" VARCHAR(100) NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "analysis_status" "photo_analysis_status" NOT NULL DEFAULT 'pending',
  "analysis_json" JSONB,
  "analysis_model" VARCHAR(100),
  "analyzed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "person_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "idx_person_photos_person_category" ON "person_photos"("person_id", "category");
CREATE INDEX "idx_person_photos_person_status" ON "person_photos"("person_id", "analysis_status");
CREATE INDEX "idx_person_photos_user_created" ON "person_photos"("user_id", "created_at");

-- AddForeignKeys
ALTER TABLE "person_photos" ADD CONSTRAINT "person_photos_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "person_photos" ADD CONSTRAINT "person_photos_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
