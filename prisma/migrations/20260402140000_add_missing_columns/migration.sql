-- Add missing columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'tags') THEN
    ALTER TABLE "tasks" ADD COLUMN "tags" JSONB DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'applies_to') THEN
    ALTER TABLE "tasks" ADD COLUMN "applies_to" JSONB DEFAULT '[]';
  END IF;
END $$;
