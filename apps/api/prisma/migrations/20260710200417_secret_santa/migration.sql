-- CreateTable
CREATE TABLE "secret_santa_exchanges" (
    "id" TEXT NOT NULL,
    "family_group_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget_cents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secret_santa_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_santa_participants" (
    "id" TEXT NOT NULL,
    "exchange_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exclude_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_to_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secret_santa_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_secret_santa_exchanges_group" ON "secret_santa_exchanges"("family_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_secret_santa_participant" ON "secret_santa_participants"("exchange_id", "user_id");

-- AddForeignKey
ALTER TABLE "secret_santa_exchanges" ADD CONSTRAINT "secret_santa_exchanges_family_group_id_fkey" FOREIGN KEY ("family_group_id") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secret_santa_participants" ADD CONSTRAINT "secret_santa_participants_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "secret_santa_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
