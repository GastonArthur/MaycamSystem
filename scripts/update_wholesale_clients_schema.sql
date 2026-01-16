
-- Update wholesale schema to support Mayoristas Bullpadel separation and missing columns
-- This script adds the missing columns required by components/mayoristas-bullpadel-management.tsx

-- 1. Update wholesale_clients table
ALTER TABLE wholesale_clients 
ADD COLUMN IF NOT EXISTS section TEXT,
ADD COLUMN IF NOT EXISTS extra_contact TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS transport TEXT,
ADD COLUMN IF NOT EXISTS destination TEXT,
ADD COLUMN IF NOT EXISTS guide_number TEXT,
ADD COLUMN IF NOT EXISTS shipping_price NUMERIC(10, 2) DEFAULT 0;

-- Create index on section for faster filtering if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_wholesale_clients_section ON wholesale_clients(section);

-- 2. Update wholesale_order_items table
ALTER TABLE wholesale_order_items
ADD COLUMN IF NOT EXISTS stock_status TEXT,
ADD COLUMN IF NOT EXISTS observations TEXT;

-- 3. Log the schema update
INSERT INTO activity_logs (
  user_email, user_name, action, description, created_at
) 
SELECT 
  'system', 'System', 'SCHEMA_UPDATE', 'Added missing columns to wholesale tables for Bullpadel support', NOW()
LIMIT 1;
