-- Rebuild legacy task schedule rules after they were flattened to "daily".
-- Assumption used for 1.0 recovery:
--   school   -> school
--   advanced -> weekend
--   other categories keep daily

UPDATE tasks
SET
  schedule_rule = CASE
    WHEN category = 'school' THEN 'school'
    WHEN category = 'advanced' THEN 'weekend'
    ELSE 'daily'
  END,
  tags = jsonb_set(
    COALESCE(tags, '{}'::jsonb),
    '{scheduleRule}',
    to_jsonb(
      CASE
        WHEN category = 'school' THEN 'school'
        WHEN category = 'advanced' THEN 'weekend'
        ELSE 'daily'
      END
    ),
    true
  ),
  updated_at = NOW()
WHERE is_active = true;

SELECT id, name, category, schedule_rule, tags->>'scheduleRule' AS tags_schedule_rule
FROM tasks
WHERE is_active = true
ORDER BY id DESC;
