-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "birthday" TIMESTAMP(3),
    "anniversary" TIMESTAMP(3),
    "budget_min_cents" INTEGER,
    "budget_max_cents" INTEGER,
    "clothing_size_top" TEXT,
    "clothing_size_bottom" TEXT,
    "shoe_size" TEXT,
    "music_taste" TEXT,
    "favorite_brands" TEXT,
    "hobbies" TEXT,
    "food_preferences" TEXT,
    "wishlist_urls" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "never_again_items" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "never_again_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "persons_user_id_deleted_at_idx" ON "persons"("user_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "never_again_items" ADD CONSTRAINT "never_again_items_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
