-- Migration: Update sessions table schema
-- Changes: Replace time_in/time_out/units with start_time/duration_minutes
-- Add client_id and therapist_id for better relationships

BEGIN;

-- Add new columns
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS therapist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS treatment_codes JSONB;

-- Migrate existing data if any exists
UPDATE sessions 
SET 
    start_time = COALESCE(time_in, NOW()),
    duration_minutes = CASE 
        WHEN time_in IS NOT NULL AND time_out IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (time_out - time_in)) / 60
        ELSE COALESCE(units * 15, 60)
    END,
    treatment_codes = COALESCE(cpt_codes, '[]'::jsonb)
WHERE start_time IS NULL;

-- Drop old columns (commented out for safety - uncomment if you're sure)
-- ALTER TABLE sessions DROP COLUMN IF EXISTS time_in;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS time_out;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS units;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS cpt_codes;
-- ALTER TABLE sessions DROP COLUMN IF EXISTS icd10_codes;

COMMIT;