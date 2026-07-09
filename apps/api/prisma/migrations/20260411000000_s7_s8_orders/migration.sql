-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending', 'ordered', 'processing', 'shipped', 'delivered', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "status_change_source" AS ENUM ('system', 'webhook', 'manual');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "event_id" TEXT,
    "gift_record_id" TEXT,
    "suggestion_id" TEXT,
    "retailer_key" TEXT NOT NULL,
    "retailer_product_id" TEXT NOT NULL,
    "retailer_order_id" TEXT,
    "confirmation_number" TEXT,
    "product_title" TEXT NOT NULL,
    "product_description" TEXT,
    "product_image_url" TEXT,
    "price_cents" INTEGER NOT NULL,
    "platform_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "stripe_payment_intent_id" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'pending',
    "shipping_name" TEXT NOT NULL,
    "shipping_address1" TEXT NOT NULL,
    "shipping_address2" TEXT,
    "shipping_city" TEXT NOT NULL,
    "shipping_state" TEXT NOT NULL,
    "shipping_zip" TEXT NOT NULL,
    "estimated_delivery_date" TIMESTAMP(3),
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "carrier_name" TEXT,
    "delivered_at" TIMESTAMP(3),
    "placed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status" NOT NULL,
    "source" "status_change_source" NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_gift_record_id_key" ON "orders"("gift_record_id");

-- CreateIndex
CREATE INDEX "idx_orders_user_status" ON "orders"("user_id", "status", "placed_at");

-- CreateIndex
CREATE INDEX "idx_orders_person_placed" ON "orders"("person_id", "placed_at");

-- CreateIndex
CREATE INDEX "idx_order_status_history" ON "order_status_history"("order_id", "changed_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_gift_record_id_fkey" FOREIGN KEY ("gift_record_id") REFERENCES "gift_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
