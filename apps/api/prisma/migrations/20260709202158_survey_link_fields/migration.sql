-- AlterTable
ALTER TABLE "person_survey_links" ADD COLUMN     "fields" TEXT[] DEFAULT ARRAY[]::TEXT[];
