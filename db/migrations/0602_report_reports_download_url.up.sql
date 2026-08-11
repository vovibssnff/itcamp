-- 0601_report_reports_download_url.sql
-- Schema drift fix: migration 0600_report_reports was applied to local dev DBs
-- before the download_url column existed, so those tables lack it while the
-- repository (reportCols) and handlers already SELECT/UPDATE it. Add it idempotently.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS download_url TEXT NOT NULL DEFAULT '';
