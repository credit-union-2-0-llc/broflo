-- B2: request-level idempotency for standard order placement.
-- A client-supplied Idempotency-Key is persisted per order; a unique index
-- makes a replayed key (double-click / retry) collide instead of creating a
-- second order + second Stripe charge.

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");
