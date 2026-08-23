-- Run with: psql "$DATABASE_URL" -f scripts/user-lifecycle-report.sql

-- Readers and current lifecycle state
SELECT username, display_name, created_at, last_login_at, last_seen_at,
       last_active_at, last_login_client, last_login_device_type,
       last_login_browser, login_count
FROM chapter.users
WHERE environment = 'prd'
ORDER BY last_login_at DESC NULLS LAST;

-- Meaningful active-reader counts
SELECT count(*) FILTER (WHERE last_active_at >= now() - interval '1 day') AS dau,
       count(*) FILTER (WHERE last_active_at >= now() - interval '7 days') AS wau,
       count(*) FILTER (WHERE last_active_at >= now() - interval '30 days') AS mau
FROM chapter.users
WHERE environment = 'prd';

-- Web client mix in the last 30 days
SELECT client, device_type, browser, count(*) AS logins
FROM chapter.user_login_events
WHERE occurred_at >= now() - interval '30 days'
GROUP BY client, device_type, browser
ORDER BY logins DESC;
