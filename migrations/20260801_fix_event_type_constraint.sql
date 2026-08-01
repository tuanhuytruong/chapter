-- Kept safe for deployments that apply migrations independently. The canonical
-- membership migration creates usage_events with this exact constraint already.
CREATE TABLE IF NOT EXISTS chapter.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  request_key TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key, period_key, event_type, request_key)
);
ALTER TABLE chapter.usage_events DROP CONSTRAINT IF EXISTS usage_events_event_type_check;
ALTER TABLE chapter.usage_events ADD CONSTRAINT usage_events_event_type_check
  CHECK (event_type IN ('reserved','consumed','released'));
