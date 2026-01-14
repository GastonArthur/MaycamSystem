DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'wholesale_orders'
          AND column_name = 'collection_status'
    ) THEN
        ALTER TABLE public.wholesale_orders ADD COLUMN collection_status TEXT DEFAULT 'to_collect';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'wholesale_orders_collection_status_chk'
    ) THEN
        ALTER TABLE public.wholesale_orders
        ADD CONSTRAINT wholesale_orders_collection_status_chk
        CHECK (collection_status IN ('to_collect','collected'));
    END IF;
END $$;

UPDATE public.wholesale_orders
SET collection_status = COALESCE(collection_status, 'to_collect');

CREATE INDEX IF NOT EXISTS idx_wholesale_orders_collection_status
ON public.wholesale_orders(collection_status);

NOTIFY pgrst, 'reload config';
