-- CreateTable
CREATE TABLE "gift_pools" (
    "id" TEXT NOT NULL,
    "family_group_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_pool_contributions" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_pool_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_gift_pools_group" ON "gift_pools"("family_group_id");

-- CreateIndex
CREATE INDEX "idx_gift_pool_contributions_pool" ON "gift_pool_contributions"("pool_id");

-- AddForeignKey
ALTER TABLE "gift_pools" ADD CONSTRAINT "gift_pools_family_group_id_fkey" FOREIGN KEY ("family_group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_pool_contributions" ADD CONSTRAINT "gift_pool_contributions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "gift_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
