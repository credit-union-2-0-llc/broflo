-- Broflo Score was purely cosmetic gamification (no feature/tier gating
-- ever read it) and is being removed from the product entirely.
ALTER TABLE "users" DROP COLUMN "broflo_score";
