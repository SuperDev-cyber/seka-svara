-- Update avatar column to TEXT type to support base64 images
-- Run this SQL command in your PostgreSQL database

ALTER TABLE users ALTER COLUMN avatar TYPE TEXT;

-- Verify the change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'avatar';

