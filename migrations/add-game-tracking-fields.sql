-- Add comprehensive game tracking fields to games table
-- This tracks card viewers, blind players, and game results

-- Add array column for users who have viewed their cards
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS "cardViewers" text[] DEFAULT '{}';

-- Add JSON column for blind bet tracking (userId -> blind count/amounts)
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS "blindPlayers" jsonb DEFAULT '{}';

-- Add participant count
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS "participantCount" integer DEFAULT 0;

-- Add game results (winners, losers, amounts)
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS "gameResults" jsonb DEFAULT '{}';

-- Add comments for clarity
COMMENT ON COLUMN games."cardViewers" IS 'Array of user IDs who have viewed their cards';
COMMENT ON COLUMN games."blindPlayers" IS 'JSON object tracking blind bets: {userId: {count: number, totalAmount: number}}';
COMMENT ON COLUMN games."participantCount" IS 'Total number of players who participated in this game';
COMMENT ON COLUMN games."gameResults" IS 'JSON object with winners, losers, and amounts: {winners: [{userId, amount}], losers: [{userId, amount}]}';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_games_cardViewers" ON games USING GIN ("cardViewers");
CREATE INDEX IF NOT EXISTS "idx_games_status" ON games ("status");
CREATE INDEX IF NOT EXISTS "idx_games_tableId" ON games ("tableId");

