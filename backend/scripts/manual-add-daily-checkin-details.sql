ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS completed_value integer;

ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS notes varchar(500);

COMMENT ON COLUMN daily_checkins.completed_value IS 'Actual completed minutes or quantity entered by the user';
COMMENT ON COLUMN daily_checkins.notes IS 'Optional daily task completion notes';
