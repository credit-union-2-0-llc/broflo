-- CreateEnum
CREATE TYPE "autopilot_run_status" AS ENUM ('triggered', 'order_placed', 'failed', 'skipped_budget', 'skipped_confidence', 'skipped_tier', 'skipped_no_suggestion');

-- CreateTable
CREATE TABLE "autopilot_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "occasion_types" TEXT[],
    "budget_min_cents" INTEGER NOT NULL,
    "budget_max_cents" INTEGER NOT NULL,
    "monthly_cap_cents" INTEGER NOT NULL,
    "lead_days" INTEGER NOT NULL DEFAULT 7,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "consented_from_ip" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopilot_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_runs" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "order_id" TEXT,
    "suggestion_id" TEXT,
    "status" "autopilot_run_status" NOT NULL,
    "reason" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "amount_cents" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autopilot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_autopilot_user_person" ON "autopilot_rules"("user_id", "person_id");

-- CreateIndex
CREATE INDEX "idx_autopilot_user_active" ON "autopilot_rules"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_autopilot_runs_rule" ON "autopilot_runs"("rule_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_autopilot_runs_event" ON "autopilot_runs"("event_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_unread" ON "notifications"("user_id", "is_read", "created_at");

-- AddForeignKey
ALTER TABLE "autopilot_rules" ADD CONSTRAINT "autopilot_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autopilot_rules" ADD CONSTRAINT "autopilot_rules_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autopilot_runs" ADD CONSTRAINT "autopilot_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "autopilot_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autopilot_runs" ADD CONSTRAINT "autopilot_runs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
