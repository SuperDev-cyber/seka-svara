-- Fix platformScore scale from 2 to 0 (whole numbers only)
-- This migration updates the platformScore column to use scale 0 instead of scale 2

-- Step 1: Update the column type to use scale 0
ALTER TABLE users 
ALTER COLUMN "platformScore" TYPE DECIMAL(18, 0);

-- Step 2: Update any existing values to ensure they're whole numbers
-- This will multiply values by 100 if they were stored as decimals (e.g., 2.90 becomes 290)
UPDATE users 
SET "platformScore" = ROUND("platformScore" * 100)
WHERE "platformScore" < 1000 AND "platformScore" > 0;

-- Note: This assumes values less than 1000 were stored with the wrong scale
-- Adjust the condition if needed based on your data

