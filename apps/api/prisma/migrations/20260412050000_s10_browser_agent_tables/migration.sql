-- S-10: Browser Agent Fallback tables

-- Enums
CREATE TYPE "agent_job_status" AS ENUM ('queued', 'running', 'previewing', 'placing', 'completed', 'failed', 'aborted');
CREATE TYPE "agent_failure_reason" AS ENUM ('captcha', 'out_of_stock', 'blocked', 'timeout', 'price_mismatch', 'payment_declined', 'address_rejected', 'unknown');
CREATE TYPE "agent_step_action" AS ENUM ('navigate', 'search', 'filter', 'select_product', 'add_to_cart', 'enter_address', 'enter_payment', 'confirm_order', 'capture_confirmation', 'detect_captcha', 'detect_oos', 'error');
CREATE TYPE "agent_step_status" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

-- AgentJob
CREATE TABLE "agent_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "suggestion_id" TEXT,
    "autopilot_run_id" TEXT,
    "status" "agent_job_status" NOT NULL DEFAULT 'queued',
    "retailer_domain" TEXT NOT NULL,
    "retailer_url" TEXT NOT NULL,
    "search_terms" TEXT NOT NULL,
    "max_budget_cents" INTEGER NOT NULL,
    "shipping_name" TEXT NOT NULL,
    "shipping_address1" TEXT NOT NULL,
    "shipping_address2" TEXT,
    "shipping_city" TEXT NOT NULL,
    "shipping_state" TEXT NOT NULL,
    "shipping_zip" TEXT NOT NULL,
    "found_product_title" TEXT,
    "found_product_price" INTEGER,
    "found_product_url" TEXT,
    "found_product_image" TEXT,
    "match_confidence" DOUBLE PRECISION,
    "confirmation_number" TEXT,
    "browser_session_id" TEXT,
    "stripe_virtual_card_id" TEXT,
    "failure_reason" "agent_failure_reason",
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 2,
    "idempotency_key" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_jobs_pkey" PRIMARY KEY ("id")
);

-- AgentStep
CREATE TABLE "agent_steps" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "action" "agent_step_action" NOT NULL,
    "status" "agent_step_status" NOT NULL DEFAULT 'pending',
    "screenshot_url" TEXT,
    "page_url" TEXT,
    "ai_model_used" TEXT,
    "ai_confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_steps_pkey" PRIMARY KEY ("id")
);

-- RetailerProfile
CREATE TABLE "retailer_profiles" (
    "id" TEXT NOT NULL,
    "retailer_domain" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT true,
    "search_url_pattern" TEXT,
    "captcha_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "total_successes" INTEGER NOT NULL DEFAULT 0,
    "avg_execution_ms" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "blocked_since" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retailer_profiles_pkey" PRIMARY KEY ("id")
);

-- ServiceCredit
CREATE TABLE "service_credits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_job_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "stripe_coupon_id" TEXT,
    "billing_cycle_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_credits_pkey" PRIMARY KEY ("id")
);

-- FailureReview
CREATE TABLE "failure_reviews" (
    "id" TEXT NOT NULL,
    "agent_job_id" TEXT NOT NULL,
    "retailer_domain" TEXT NOT NULL,
    "failure_reason" TEXT NOT NULL,
    "is_systemic" BOOLEAN,
    "review_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failure_reviews_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "agent_jobs_order_id_key" ON "agent_jobs"("order_id");
CREATE UNIQUE INDEX "agent_jobs_autopilot_run_id_key" ON "agent_jobs"("autopilot_run_id");
CREATE UNIQUE INDEX "agent_jobs_idempotency_key_key" ON "agent_jobs"("idempotency_key");
CREATE UNIQUE INDEX "retailer_profiles_retailer_domain_key" ON "retailer_profiles"("retailer_domain");
CREATE UNIQUE INDEX "uq_agent_step_job_number" ON "agent_steps"("job_id", "step_number");
CREATE UNIQUE INDEX "uq_service_credit_user_cycle" ON "service_credits"("user_id", "billing_cycle_key");

-- Indexes
CREATE INDEX "idx_agent_jobs_user_status" ON "agent_jobs"("user_id", "status");
CREATE INDEX "idx_agent_jobs_status_queue" ON "agent_jobs"("status", "created_at");
CREATE INDEX "idx_agent_jobs_retailer" ON "agent_jobs"("retailer_domain", "status");
CREATE INDEX "idx_agent_steps_job" ON "agent_steps"("job_id", "step_number");
CREATE INDEX "idx_service_credits_user" ON "service_credits"("user_id", "created_at");
CREATE INDEX "idx_failure_reviews_unresolved" ON "failure_reviews"("resolved_at", "created_at");
CREATE INDEX "idx_failure_reviews_retailer" ON "failure_reviews"("retailer_domain");

-- Foreign keys
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "agent_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_credits" ADD CONSTRAINT "service_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
