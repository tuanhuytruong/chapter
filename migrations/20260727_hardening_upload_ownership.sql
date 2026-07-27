-- Additive upload ownership hardening. Safe to run repeatedly.
CREATE SCHEMA IF NOT EXISTS chapter;
CREATE TABLE IF NOT EXISTS chapter.uploaded_files (
  file_path TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_owner_unclaimed
  ON chapter.uploaded_files (owner_id) WHERE claimed_at IS NULL;
