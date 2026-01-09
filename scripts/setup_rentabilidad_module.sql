-- SETUP RENTABILIDAD REAL MODULE
-- This script creates the necessary tables for the "Rentabilidad Real" module.
-- It is designed to be 100% backward compatible and additive.

-- 1. ML Accounts
CREATE TABLE IF NOT EXISTS rt_ml_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  seller_id BIGINT UNIQUE,
  refresh_token TEXT NOT NULL, -- Store securely (this is a simple implementation, consider encryption in app)
  access_token TEXT,
  access_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SKU Mapping
CREATE TABLE IF NOT EXISTS rt_ml_sku_map (
  account_id UUID REFERENCES rt_ml_accounts(id),
  sku TEXT NOT NULL,
  item_id TEXT NOT NULL,
  variation_id BIGINT,
  last_resolved_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  PRIMARY KEY (account_id, sku)
);

-- 3. Stock
CREATE TABLE IF NOT EXISTS rt_stock_current (
  account_id UUID REFERENCES rt_ml_accounts(id),
  sku TEXT NOT NULL,
  qty INTEGER, -- null = not published/found
  status TEXT, -- "Stock"|"Sin stock"|"No publicado"
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (account_id, sku)
);

CREATE TABLE IF NOT EXISTS rt_stock_history (
  id SERIAL PRIMARY KEY,
  account_id UUID REFERENCES rt_ml_accounts(id),
  sku TEXT NOT NULL,
  qty INTEGER,
  status TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Orders Raw (MercadoLibre)
CREATE TABLE IF NOT EXISTS rt_ml_orders (
  account_id UUID REFERENCES rt_ml_accounts(id),
  order_id BIGINT NOT NULL,
  status TEXT,
  date_created TIMESTAMP WITH TIME ZONE,
  total_amount NUMERIC(20, 2),
  paid_amount NUMERIC(20, 2),
  buyer_id BIGINT,
  shipment_id BIGINT,
  payment_ids JSONB,
  raw JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (account_id, order_id)
);

CREATE TABLE IF NOT EXISTS rt_ml_order_items (
  id SERIAL PRIMARY KEY,
  account_id UUID REFERENCES rt_ml_accounts(id),
  order_id BIGINT, -- No FK constraint to rt_ml_orders to allow partial sync/out of order, or strictly add it. Let's add simple index.
  sku TEXT,
  item_id TEXT,
  variation_id BIGINT,
  title TEXT,
  quantity INTEGER,
  unit_price NUMERIC(20, 2),
  discount NUMERIC(20, 2),
  raw JSONB,
  FOREIGN KEY (account_id, order_id) REFERENCES rt_ml_orders(account_id, order_id)
);

-- 5. Internal Sales Normalization (Generic Sales Model)
-- Created because existing 'wholesale_orders' is specific to B2B.
CREATE TABLE IF NOT EXISTS rt_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel TEXT NOT NULL, -- 'ML', etc.
  account_id UUID REFERENCES rt_ml_accounts(id),
  external_order_id TEXT, -- formatted seller_id-order_id or just order_id
  status TEXT,
  sold_at TIMESTAMP WITH TIME ZONE,
  gross_income NUMERIC(20, 2),
  net_income NUMERIC(20, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel, account_id, external_order_id)
);

CREATE TABLE IF NOT EXISTS rt_sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES rt_sales(id),
  sku TEXT,
  qty INTEGER,
  sale_unit_price NUMERIC(20, 2),
  sale_unit_discount NUMERIC(20, 2),
  cost_unit_at_sale NUMERIC(20, 2), -- Historical Cost Snapshot
  product_name_snapshot TEXT
);

-- 6. Profitability Calculation
CREATE TABLE IF NOT EXISTS rt_sale_profit (
  sale_id UUID PRIMARY KEY REFERENCES rt_sales(id),
  gross_income NUMERIC(20, 2),
  cogs NUMERIC(20, 2),
  total_charges NUMERIC(20, 2),
  real_profit NUMERIC(20, 2),
  profit_pct NUMERIC(10, 4), -- 0.15 = 15%
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rt_sale_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES rt_sales(id),
  type TEXT NOT NULL, -- ml_fee, financing_fee, shipping_cost, etc.
  amount NUMERIC(20, 2),
  source TEXT, -- ml_billing, mp_report, manual
  external_ref TEXT, -- unique reference from source
  occurred_at TIMESTAMP WITH TIME ZONE,
  raw JSONB,
  UNIQUE(external_ref)
);

-- 7. Jobs (Sync State)
CREATE TABLE IF NOT EXISTS rt_jobs (
  name TEXT PRIMARY KEY,
  cursor JSONB,
  locked_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Simulator (Pricing Plans)
CREATE TABLE IF NOT EXISTS rt_pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES rt_ml_accounts(id), -- Nullable for global
  plan TEXT, -- "SIN", "3", "6", "9", "12"
  markup_pct NUMERIC(10, 4),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Shadow Products (Fallback if no inventory table exists)
CREATE TABLE IF NOT EXISTS rt_products_shadow (
  sku TEXT PRIMARY KEY,
  cost_unit NUMERIC(20, 2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rt_ml_sku_map_sku ON rt_ml_sku_map(sku);
CREATE INDEX IF NOT EXISTS idx_rt_ml_orders_date ON rt_ml_orders(date_created);
CREATE INDEX IF NOT EXISTS idx_rt_sales_sold_at ON rt_sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_rt_sale_items_sku ON rt_sale_items(sku);
CREATE INDEX IF NOT EXISTS idx_rt_sale_charges_sale_id ON rt_sale_charges(sale_id);
