-- Migration: Add hasSeenCards column for blind betting feature
-- Date: 2025-10-20
-- Description: Adds hasSeenCards boolean flag to game_players table

-- Add hasSeenCards column with default false
ALTER TABLE game_players 
ADD COLUMN IF NOT EXISTS "hasSeenCards" boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN game_players."hasSeenCards" IS 'Whether player has looked at their cards (for blind betting mechanic)';

-- Verify migration
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'game_players' AND column_name = 'hasSeenCards';

