-- Add is_paid column to wholesale_orders table
ALTER TABLE public.wholesale_orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
