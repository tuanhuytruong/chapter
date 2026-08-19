-- Allow the dedicated account-creation rate limit scope. Safe to run once per release.
ALTER TABLE chapter.auth_rate_limits DROP CONSTRAINT IF EXISTS auth_rate_limits_scope_check;
ALTER TABLE chapter.auth_rate_limits ADD CONSTRAINT auth_rate_limits_scope_check
  CHECK (scope IN ('login','signup','forgot_password','reset_password','oauth'));
