-- NeverAgainItem is eager-loaded (include: { neverAgainItems: true }) on every
-- suggestion generation and queried per person in enrichment. Without an index
-- on person_id these degrade to sequential scans as the table grows.

-- CreateIndex
CREATE INDEX "idx_never_again_person" ON "never_again_items"("person_id");
