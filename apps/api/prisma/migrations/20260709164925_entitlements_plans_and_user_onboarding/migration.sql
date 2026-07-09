-- CreateEnum
CREATE TYPE "plan_limit_type" AS ENUM ('BOOLEAN', 'INTEGER', 'CENTS', 'STRING');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "pending_plan_key" TEXT;

-- Backfill: every user that already exists has, by definition, already
-- gone through signup before this gate existed — treat them as onboarded
-- as of when their account was created. Without this, every existing
-- user gets redirected to plan-selection on next login.
UPDATE "users" SET "onboarding_completed_at" = "created_at" WHERE "onboarding_completed_at" IS NULL;

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_monthly_cents" INTEGER NOT NULL DEFAULT 0,
    "price_annual_cents" INTEGER NOT NULL DEFAULT 0,
    "stripe_price_id_monthly" TEXT,
    "stripe_price_id_annual" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_limits" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "type" "plan_limit_type" NOT NULL,
    "bool_value" BOOLEAN,
    "int_value" INTEGER,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "string_value" TEXT,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE INDEX "idx_plan_limits_feature_key" ON "plan_limits"("feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_plan_limit_plan_feature" ON "plan_limits"("plan_id", "feature_key");

-- AddForeignKey
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
