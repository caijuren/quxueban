-- Add new columns to reading_logs if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reading_logs' AND column_name = 'effect') THEN
    ALTER TABLE reading_logs ADD COLUMN effect VARCHAR(50) DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reading_logs' AND column_name = 'performance') THEN
    ALTER TABLE reading_logs ADD COLUMN performance VARCHAR(200) DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reading_logs' AND column_name = 'note') THEN
    ALTER TABLE reading_logs ADD COLUMN note VARCHAR(500) DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reading_logs' AND column_name = 'read_stage') THEN
    ALTER TABLE reading_logs ADD COLUMN read_stage VARCHAR(50) DEFAULT '';
  END IF;
END $$;

-- Add missing columns to books if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'character_tag') THEN
    ALTER TABLE books ADD COLUMN character_tag VARCHAR(50) DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'read_count') THEN
    ALTER TABLE books ADD COLUMN read_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'total_pages') THEN
    ALTER TABLE books ADD COLUMN total_pages INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'cover_url') THEN
    ALTER TABLE books ADD COLUMN cover_url VARCHAR(500) DEFAULT '';
  END IF;
END $$;
