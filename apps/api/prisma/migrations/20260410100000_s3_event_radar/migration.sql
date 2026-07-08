-- CreateEnum
CREATE TYPE "occasion_type" AS ENUM ('birthday', 'anniversary', 'holiday', 'graduation', 'promotion', 'custom');

-- CreateEnum
CREATE TYPE "recurrence_rule" AS ENUM ('annual', 'one_time');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occasion_type" "occasion_type" NOT NULL,
    "date" DATE NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" "recurrence_rule" NOT NULL DEFAULT 'one_time',
    "budget_min_cents" INTEGER,
    "budget_max_cents" INTEGER,
    "notes" TEXT,
    "is_auto_created" BOOLEAN NOT NULL DEFAULT false,
    "user_modified" BOOLEAN NOT NULL DEFAULT false,
    "user_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lead_days" INTEGER NOT NULL,
    "scheduled_for" DATE NOT NULL,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_person_auto_event" ON "events"("person_id", "occasion_type", "is_auto_created");

-- CreateIndex
CREATE INDEX "idx_events_user_date" ON "events"("user_id", "date");

-- CreateIndex
CREATE INDEX "idx_events_person" ON "events"("person_id");

-- CreateIndex
CREATE INDEX "idx_events_user_occasion" ON "events"("user_id", "occasion_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_reminder_event_lead_scheduled" ON "reminders"("event_id", "lead_days", "scheduled_for");

-- CreateIndex
CREATE INDEX "idx_reminders_user_active" ON "reminders"("user_id", "dismissed_at", "scheduled_for");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
