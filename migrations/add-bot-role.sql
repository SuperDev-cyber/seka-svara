-- Add 'bot' role to users_role_enum
-- This allows creation of computer opponent accounts

ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'bot';

-- Verify the change
SELECT enum_range(NULL::users_role_enum);

