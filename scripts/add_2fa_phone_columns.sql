-- Add columns for extended 2FA support (Phone/SMS)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS two_factor_method VARCHAR(20) DEFAULT 'app', -- 'app', 'sms', 'email'
ADD COLUMN IF NOT EXISTS two_factor_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS two_factor_expires TIMESTAMP WITH TIME ZONE;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
