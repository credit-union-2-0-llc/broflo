-- OTP auth migration: drop password/OAuth columns no longer used
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_token";
ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_token_expires";
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_logins";
ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until";

-- Drop the unique index on google_id if it exists
DROP INDEX IF EXISTS "users_google_id_key";
