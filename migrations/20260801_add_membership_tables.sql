-- Phase 0+1+2: Membership entitlement, usage tracking, and upgrade prompts
-- Canonical idempotent migration. It upgrades the early Phase-0 draft schema in
-- place so it matches src/db/schema.sql and the live runtime queries.

CREATE TABLE IF NOT EXISTS chapter.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES chapter.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  granted_by TEXT NOT NULL DEFAULT 'admin',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE chapter.subscriptions ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE chapter.subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id TEXT;
ALTER TABLE chapter.subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
ALTER TABLE chapter.subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE chapter.subscriptions ALTER COLUMN tier SET DEFAULT 'free';
ALTER TABLE chapter.subscriptions ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE chapter.subscriptions ALTER COLUMN granted_by SET DEFAULT 'admin';
UPDATE chapter.subscriptions SET granted_by = 'admin' WHERE granted_by IS NULL;
ALTER TABLE chapter.subscriptions ALTER COLUMN granted_by SET NOT NULL;
ALTER TABLE chapter.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE chapter.subscriptions ADD CONSTRAINT subscriptions_tier_check CHECK (tier IN ('free','plus','deep_reader'));
ALTER TABLE chapter.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE chapter.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active','trialing','canceled','past_due','expired'));
ALTER TABLE chapter.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_granted_by_check;
ALTER TABLE chapter.subscriptions ADD CONSTRAINT subscriptions_granted_by_check CHECK (granted_by IN ('payment','trial','admin','founding'));
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_unique
  ON chapter.subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS chapter.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('reserved','consumed','released')),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  request_key TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key, period_key, event_type, request_key)
);
CREATE INDEX IF NOT EXISTS usage_events_owner_period_feature
  ON chapter.usage_events (user_id, period_key, feature_key);

-- Preserve completed observations from the short-lived draft table when it was
-- applied before this canonical migration. The old model had no quantity field,
-- so every durable request maps to one consumed event; unfinished reservations
-- are deliberately not migrated because they may be stale after deployment.
DO $$
BEGIN
  IF to_regclass('chapter.ai_usage_events') IS NOT NULL THEN
    INSERT INTO chapter.usage_events (user_id, feature_key, period_key, event_type, request_key, created_at)
    SELECT user_id, feature_key, period_key, 'consumed', request_key, COALESCE(consumed_at, created_at)
    FROM chapter.ai_usage_events
    WHERE consumed_at IS NOT NULL
    ON CONFLICT (user_id, feature_key, period_key, event_type, request_key) DO NOTHING;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS chapter.membership_prompt_state (
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL CHECK (prompt_key IN ('reading_map_depth', 'book_wiki_depth', 'quota_reached')),
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, prompt_key)
);
CREATE INDEX IF NOT EXISTS idx_membership_prompt_state_owner
  ON chapter.membership_prompt_state (owner_id);
