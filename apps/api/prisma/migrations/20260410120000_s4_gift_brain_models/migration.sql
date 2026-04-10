-- S-4 Gift Brain: new enums, GiftSuggestion, GiftRecord, AiAuditLog

-- Enums
CREATE TYPE "gift_source" AS ENUM ('suggestion', 'manual');
CREATE TYPE "audit_status" AS ENUM ('success', 'error', 'timeout', 'rate_limited');
CREATE TYPE "surprise_factor" AS ENUM ('safe', 'bold');

-- GiftSuggestion
CREATE TABLE "gift_suggestions" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_price_min_cents" INTEGER NOT NULL,
    "estimated_price_max_cents" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "delight_score" DOUBLE PRECISION NOT NULL,
    "novelty_score" DOUBLE PRECISION NOT NULL,
    "retailer_hint" TEXT,
    "suggested_message" TEXT,
    "model_version" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "request_index" INTEGER NOT NULL DEFAULT 0,
    "surprise_factor" "surprise_factor" NOT NULL DEFAULT 'safe',
    "guidance_text" TEXT,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissal_reason" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_suggestions_pkey" PRIMARY KEY ("id")
);

-- GiftRecord
CREATE TABLE "gift_records" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "event_id" TEXT,
    "user_id" TEXT NOT NULL,
    "suggestion_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER,
    "given_at" DATE NOT NULL,
    "rating" INTEGER,
    "feedback_note" TEXT,
    "image_url" TEXT,
    "source" "gift_source" NOT NULL DEFAULT 'manual',
    "suggestion_snapshot" JSONB,
    "feedback_scored" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_records_pkey" PRIMARY KEY ("id")
);

-- AiAuditLog
CREATE TABLE "ai_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "prompt_cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "suggestions_returned" INTEGER NOT NULL,
    "suggestions_filtered" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "status" "audit_status" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "gift_records_suggestion_id_key" ON "gift_records"("suggestion_id");

-- GiftSuggestion indexes
CREATE INDEX "idx_suggestions_event_request" ON "gift_suggestions"("event_id", "request_index", "is_dismissed");
CREATE INDEX "idx_suggestions_person_selected" ON "gift_suggestions"("person_id", "is_selected");
CREATE INDEX "idx_suggestions_user_created" ON "gift_suggestions"("user_id", "created_at");
CREATE INDEX "idx_suggestions_expires" ON "gift_suggestions"("expires_at");

-- GiftRecord indexes
CREATE INDEX "idx_gifts_person_given" ON "gift_records"("person_id", "given_at");
CREATE INDEX "idx_gifts_user_given" ON "gift_records"("user_id", "given_at");
CREATE INDEX "idx_gifts_event" ON "gift_records"("event_id");
CREATE INDEX "idx_gifts_person_rating" ON "gift_records"("person_id", "rating");

-- AiAuditLog indexes
CREATE INDEX "idx_audit_user_created" ON "ai_audit_logs"("user_id", "created_at");
CREATE INDEX "idx_audit_created" ON "ai_audit_logs"("created_at");
CREATE INDEX "idx_audit_status_created" ON "ai_audit_logs"("status", "created_at");
CREATE INDEX "idx_audit_model_created" ON "ai_audit_logs"("model", "created_at");
CREATE INDEX "idx_audit_tier_created" ON "ai_audit_logs"("tier", "created_at");

-- Foreign keys: GiftSuggestion
ALTER TABLE "gift_suggestions" ADD CONSTRAINT "gift_suggestions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_suggestions" ADD CONSTRAINT "gift_suggestions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_suggestions" ADD CONSTRAINT "gift_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: GiftRecord
ALTER TABLE "gift_records" ADD CONSTRAINT "gift_records_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_records" ADD CONSTRAINT "gift_records_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_records" ADD CONSTRAINT "gift_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_records" ADD CONSTRAINT "gift_records_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "gift_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: AiAuditLog (only userId — personId/eventId are plain strings for audit durability)
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
