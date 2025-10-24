-- Migration: Add dealerId to games table and handScore/handDescription to game_players table
-- Date: 2025-10-20
-- Description: Adds dealer tracking and hand evaluation scores for improved gameplay experience

-- Add dealerId to games table (tracks current dealer)
ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "dealerId" varchar;

-- Add handScore to game_players table (stores evaluated hand value)
ALTER TABLE "game_players" ADD COLUMN IF NOT EXISTS "handScore" integer;

-- Add handDescription to game_players table (stores hand description like "Three 7s", "Flush - 25 points")
ALTER TABLE "game_players" ADD COLUMN IF NOT EXISTS "handDescription" varchar;

-- Update existing games to set dealerId to NULL (will be set in next game)
UPDATE "games" SET "dealerId" = NULL WHERE "dealerId" IS NULL;

-- Update existing game_players to set handScore and handDescription to NULL
UPDATE "game_players" SET "handScore" = NULL, "handDescription" = NULL 
WHERE "handScore" IS NULL AND "handDescription" IS NULL;

-- Success message
SELECT 'Migration completed: Added dealerId, handScore, and handDescription columns' AS status;

