-- AlterEnum
ALTER TYPE "autopilot_run_status" ADD VALUE 'ready_for_review';

-- AlterTable
ALTER TABLE "wishlist_items" ADD COLUMN     "event_id" TEXT,
ADD COLUMN     "image_url" VARCHAR(2000),
ALTER COLUMN "source_url" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "idx_wishlist_items_event" ON "wishlist_items"("event_id");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
