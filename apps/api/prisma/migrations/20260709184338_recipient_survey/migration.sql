-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "recipient_email" TEXT;

-- CreateTable
CREATE TABLE "person_survey_links" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "person_survey_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_survey_responses" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "survey_link_id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "person_survey_links_token_key" ON "person_survey_links"("token");

-- CreateIndex
CREATE INDEX "idx_survey_links_person" ON "person_survey_links"("person_id");

-- CreateIndex
CREATE INDEX "idx_survey_responses_person_status" ON "person_survey_responses"("person_id", "status");

-- AddForeignKey
ALTER TABLE "person_survey_links" ADD CONSTRAINT "person_survey_links_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_survey_responses" ADD CONSTRAINT "person_survey_responses_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_survey_responses" ADD CONSTRAINT "person_survey_responses_survey_link_id_fkey" FOREIGN KEY ("survey_link_id") REFERENCES "person_survey_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
