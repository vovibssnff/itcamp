-- Close active sessions left without an in-memory runner, then delete
-- never-started rows and sessions force-stopped by orphan cleanup.
BEGIN;

UPDATE sessions
SET status = 'stopped',
    stopped_at = COALESCE(stopped_at, now())
WHERE status IN ('running', 'paused');

CREATE TEMP TABLE orphan_ids AS
SELECT id FROM sessions
WHERE status = 'created'
   OR (
        status = 'stopped'
    AND started_at IS NOT NULL
    AND stopped_at IS NOT NULL
    AND stopped_at >= TIMESTAMPTZ '2026-08-11 12:16:57+00'
    AND stopped_at <  TIMESTAMPTZ '2026-08-11 12:16:58+00'
   );

DELETE FROM operator_actions WHERE session_id IN (SELECT id FROM orphan_ids);
DELETE FROM fault_events     WHERE session_id IN (SELECT id FROM orphan_ids);
DELETE FROM alarm_events     WHERE session_id IN (SELECT id FROM orphan_ids);
DELETE FROM sessions         WHERE id IN (SELECT id FROM orphan_ids);

COMMIT;

SELECT status, count(*) FROM sessions GROUP BY 1 ORDER BY 1;
