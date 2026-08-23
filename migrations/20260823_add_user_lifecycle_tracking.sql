-- Privacy-safe web lifecycle tracking. Existing accounts remain unbackfilled.
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS last_login_client TEXT;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS last_login_device_type TEXT;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS last_login_browser TEXT;
ALTER TABLE chapter.users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chapter.users DROP CONSTRAINT IF EXISTS users_last_login_client_check;
ALTER TABLE chapter.users ADD CONSTRAINT users_last_login_client_check CHECK (last_login_client IS NULL OR last_login_client IN ('web_desktop','web_android','web_ios'));
ALTER TABLE chapter.users DROP CONSTRAINT IF EXISTS users_last_login_device_type_check;
ALTER TABLE chapter.users ADD CONSTRAINT users_last_login_device_type_check CHECK (last_login_device_type IS NULL OR last_login_device_type IN ('desktop','mobile','tablet'));
ALTER TABLE chapter.users DROP CONSTRAINT IF EXISTS users_last_login_browser_check;
ALTER TABLE chapter.users ADD CONSTRAINT users_last_login_browser_check CHECK (last_login_browser IS NULL OR last_login_browser IN ('chrome','safari','firefox','edge','other'));

CREATE TABLE IF NOT EXISTS chapter.user_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), auth_method TEXT NOT NULL CHECK (auth_method IN ('password','google','password_reset')),
  client TEXT NOT NULL CHECK (client IN ('web_desktop','web_android','web_ios')),
  device_type TEXT NOT NULL CHECK (device_type IN ('desktop','mobile','tablet')),
  browser TEXT NOT NULL CHECK (browser IN ('chrome','safari','firefox','edge','other')), is_pwa BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_user_login_events_user_occurred ON chapter.user_login_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON chapter.users (last_active_at DESC) WHERE last_active_at IS NOT NULL;
