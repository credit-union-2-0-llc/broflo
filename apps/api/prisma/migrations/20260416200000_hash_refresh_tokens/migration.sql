-- Rename refresh_token to refresh_token_hash and hash existing values
ALTER TABLE "users" RENAME COLUMN "refresh_token" TO "refresh_token_hash";

-- Hash any existing plaintext refresh tokens (SHA-256)
UPDATE "users"
SET "refresh_token_hash" = encode(sha256("refresh_token_hash"::bytea), 'hex')
WHERE "refresh_token_hash" IS NOT NULL;
