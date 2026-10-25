-- Additive shared-DB migration.
ALTER TABLE chapter.podcasts ADD COLUMN IF NOT EXISTS worker_lease_token UUID;
ALTER TABLE chapter.podcasts ADD COLUMN IF NOT EXISTS worker_lease_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_podcasts_recovery_lease ON chapter.podcasts (status, worker_lease_until) WHERE worker_lease_until IS NOT NULL;
