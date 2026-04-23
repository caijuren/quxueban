UPDATE tasks
SET schedule_rule = tags->>'scheduleRule'
WHERE is_active = true
  AND tags ? 'scheduleRule'
  AND (tags->>'scheduleRule') IN ('daily', 'school', 'weekend', 'flexible')
  AND (
    schedule_rule IS NULL
    OR schedule_rule = ''
    OR schedule_rule = 'daily'
  );

SELECT id, name, schedule_rule, tags->>'scheduleRule' AS tags_schedule_rule
FROM tasks
WHERE is_active = true
ORDER BY id DESC
LIMIT 20;
