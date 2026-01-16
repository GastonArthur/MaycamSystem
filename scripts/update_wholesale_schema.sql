
-- 1. Add missing columns to wholesale_orders to match retail sales structure
ALTER TABLE wholesale_orders 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_status TEXT CHECK (stock_status IN ('restado', 'pendiente')) DEFAULT 'restado',
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pagado', 'pendiente', 'no_pagado')) DEFAULT 'no_pagado',
ADD COLUMN IF NOT EXISTS delivery_status TEXT CHECK (delivery_status IN ('entregado', 'pendiente', 'no_entregado')) DEFAULT 'no_entregado',
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS bultos INTEGER DEFAULT 0;

-- 2. Migrate existing status data
-- Sync payment_status with is_paid
UPDATE wholesale_orders 
SET payment_status = 'pagado' 
WHERE is_paid = true;

-- Sync delivery_status with status
UPDATE wholesale_orders 
SET delivery_status = 'entregado' 
WHERE status = 'delivered';

UPDATE wholesale_orders 
SET delivery_status = 'pendiente' 
WHERE status = 'pending';

-- 3. Advanced Migration: Convert "ENVIO" items to shipping_cost column
DO $$
DECLARE
    r RECORD;
    envio_amount NUMERIC;
BEGIN
    -- Loop through orders that have items looking like 'ENVIO' (case insensitive)
    FOR r IN 
        SELECT DISTINCT order_id 
        FROM wholesale_order_items 
        WHERE description ILIKE '%ENVIO%' OR sku ILIKE '%ENVIO%'
    LOOP
        -- Calculate total shipping cost from items for this order
        SELECT COALESCE(SUM(total_price), 0) INTO envio_amount
        FROM wholesale_order_items
        WHERE order_id = r.order_id AND (description ILIKE '%ENVIO%' OR sku ILIKE '%ENVIO%');

        -- Update the order: set shipping_cost, adjust subtotal
        -- We assume current total_amount is correct and includes the shipping item.
        -- New Subtotal = Current Total - Shipping Cost (assuming no discount previously)
        UPDATE wholesale_orders
        SET shipping_cost = envio_amount,
            subtotal = total_amount - envio_amount
        WHERE id = r.order_id;

        -- Delete the shipping items so they don't appear as products anymore
        DELETE FROM wholesale_order_items
        WHERE order_id = r.order_id AND (description ILIKE '%ENVIO%' OR sku ILIKE '%ENVIO%');
        
        RAISE NOTICE 'Migrated shipping for order %: amount %', r.order_id, envio_amount;
    END LOOP;
END $$;

-- 4. Final cleanup: Ensure subtotal is set for orders that didn't have shipping items
-- If subtotal is 0 and total > 0, set subtotal = total (assuming no shipping/discount)
UPDATE wholesale_orders 
SET subtotal = total_amount 
WHERE (subtotal IS NULL OR subtotal = 0) AND total_amount > 0;
