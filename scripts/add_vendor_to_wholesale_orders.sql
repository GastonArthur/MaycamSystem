-- Add 'vendor' column to wholesale_orders table if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'wholesale_orders'
          AND column_name = 'vendor'
    ) THEN
        ALTER TABLE public.wholesale_orders ADD COLUMN vendor TEXT;
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload config';
