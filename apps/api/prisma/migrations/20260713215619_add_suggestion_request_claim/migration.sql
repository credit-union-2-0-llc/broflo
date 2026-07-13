-- CreateTable
CREATE TABLE "suggestion_request_claims" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_request_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_suggestion_claim_event_request" ON "suggestion_request_claims"("event_id", "request_index");

-- AddForeignKey
ALTER TABLE "suggestion_request_claims" ADD CONSTRAINT "suggestion_request_claims_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
