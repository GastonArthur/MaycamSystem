
-- Create Retail Sales Tables

CREATE TABLE IF NOT EXISTS retail_sales (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    client_id INTEGER REFERENCES retail_clients(id),
    client_name TEXT NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    shipping_cost NUMERIC(10, 2) DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stock_status TEXT CHECK (stock_status IN ('restado', 'pendiente')) DEFAULT 'restado',
    payment_status TEXT CHECK (payment_status IN ('pagado', 'pendiente', 'no_pagado')) DEFAULT 'no_pagado',
    delivery_status TEXT CHECK (delivery_status IN ('entregado', 'pendiente', 'no_entregado')) DEFAULT 'no_entregado',
    tracking_number TEXT,
    bultos INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS retail_sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES retail_sales(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    cost NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_retail_sales_client_id ON retail_sales(client_id);
CREATE INDEX IF NOT EXISTS idx_retail_sale_items_sale_id ON retail_sale_items(sale_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_retail_sales_updated_at ON retail_sales;
CREATE TRIGGER update_retail_sales_updated_at
  BEFORE UPDATE ON retail_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
