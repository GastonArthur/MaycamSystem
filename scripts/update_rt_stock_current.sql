-- Add title and thumbnail to rt_stock_current
ALTER TABLE rt_stock_current ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE rt_stock_current ADD COLUMN IF NOT EXISTS thumbnail TEXT;
