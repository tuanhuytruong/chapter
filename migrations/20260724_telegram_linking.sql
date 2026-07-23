-- Telegram per-user deep-linking V1. Safe to run repeatedly.
BEGIN;

ALTER TABLE chapter.users
  ADD COLUMN IF NOT EXISTS telegram_link_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_link_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_link_token
  ON chapter.users (telegram_link_token)
  WHERE telegram_link_token IS NOT NULL;

COMMIT;

-- Verification: expected true values after migration.
SELECT
  to_regclass('chapter.users') AS users_table,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'chapter' AND table_name = 'users'
      AND column_name = 'telegram_link_token'
  ) AS has_link_token,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'chapter' AND table_name = 'users'
      AND column_name = 'telegram_link_expires_at'
  ) AS has_link_expiry;
