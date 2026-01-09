-- Script to add 'city' column to wholesale_clients table

-- Add city column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wholesale_clients' AND column_name = 'city') THEN
        ALTER TABLE public.wholesale_clients ADD COLUMN city TEXT;
    END IF;
END $$;

-- Refresh schema cache (notify PostgREST)
NOTIFY pgrst, 'reload config';
