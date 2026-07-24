-- Materialize Event.next_occurrence so upcoming() is a bounded indexed query
-- instead of loading the whole events table and computing occurrences in JS.

-- AlterTable
ALTER TABLE "events" ADD COLUMN "next_occurrence" DATE;

-- Backfill: recurring events -> next annual occurrence on/after today;
-- one-time events -> their date. Uses interval arithmetic (never errors on
-- Feb-29, unlike make_date; Postgres clamps 02-29 + 1 year to 02-28 — a
-- harmless <=1-day skew for leap-day birthdays that the app recomputes later).
UPDATE "events" SET "next_occurrence" = (
  CASE
    WHEN "is_recurring" THEN (
      "date"
      + (
          (EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM "date")::int)
          + CASE
              WHEN (
                "date"
                + ((EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM "date")::int) * INTERVAL '1 year')
              )::date < CURRENT_DATE
              THEN 1 ELSE 0
            END
        ) * INTERVAL '1 year'
    )::date
    ELSE "date"
  END
);

-- CreateIndex
CREATE INDEX "idx_events_user_next_occurrence" ON "events"("user_id", "next_occurrence");
