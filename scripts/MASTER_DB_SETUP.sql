-- MASTER DATABASE SETUP SCRIPT FOR SISTEMA 2026
-- This script sets up the entire database schema, including users, inventory, expenses, wholesale management, and profitability modules.
-- Run this script in the Supabase SQL Editor to initialize your database.

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Utility Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_cleanup_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- 3. Users and Auth (Custom Implementation)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  can_view_logs BOOLEAN DEFAULT false,
  can_view_wholesale BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id),
  -- 2FA Columns
  phone VARCHAR(50),
  two_factor_method VARCHAR(20) DEFAULT 'app', -- 'app', 'sms', 'email'
  two_factor_code VARCHAR(10),
  two_factor_expires TIMESTAMP WITH TIME ZONE
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_rentabilidad BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_precios BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_dashboard BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_products BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_stock BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_zentor BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_clients BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_brands BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_suppliers BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_wholesale_bullpadel BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_retail BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_gastos BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_compras BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_notas_credito BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_users BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- 4. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INTEGER,
  old_data JSONB,
  new_data JSONB,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action ON activity_logs(user_id, action);

-- 5. Configuration
CREATE TABLE IF NOT EXISTS config (
  id SERIAL PRIMARY KEY,
  iva_percentage DECIMAL(5,2) DEFAULT 21.00,
  wholesale_percentage_1 DECIMAL(5,2) DEFAULT 10.00,
  wholesale_percentage_2 DECIMAL(5,2) DEFAULT 17.00,
  wholesale_percentage_3 DECIMAL(5,2) DEFAULT 25.00,
  cuotas_3_percentage NUMERIC DEFAULT 20,
  cuotas_6_percentage NUMERIC DEFAULT 40,
  cuotas_9_percentage NUMERIC DEFAULT 60,
  cuotas_12_percentage NUMERIC DEFAULT 80,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default config
INSERT INTO config (id, iva_percentage, wholesale_percentage_1, wholesale_percentage_2, wholesale_percentage_3, cuotas_3_percentage, cuotas_6_percentage, cuotas_9_percentage, cuotas_12_percentage) 
VALUES (1, 21.00, 10.00, 17.00, 25.00, 20, 40, 60, 80) 
ON CONFLICT (id) DO UPDATE SET
  wholesale_percentage_1 = EXCLUDED.wholesale_percentage_1,
  wholesale_percentage_2 = EXCLUDED.wholesale_percentage_2,
  wholesale_percentage_3 = EXCLUDED.wholesale_percentage_3,
  cuotas_3_percentage = EXCLUDED.cuotas_3_percentage,
  cuotas_6_percentage = EXCLUDED.cuotas_6_percentage,
  cuotas_9_percentage = EXCLUDED.cuotas_9_percentage,
  cuotas_12_percentage = EXCLUDED.cuotas_12_percentage;

-- 6. Core Inventory Tables
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,
  ean VARCHAR(100),
  description TEXT NOT NULL,
  cost_without_tax DECIMAL(10,2) NOT NULL,
  cost_with_tax DECIMAL(10,2) NOT NULL,
  pvp_without_tax DECIMAL(10,2) NOT NULL,
  pvp_with_tax DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  company VARCHAR(50) NOT NULL CHECK (company IN ('MAYCAM', 'BLUE DOGO', 'GLOBOBAZAAR')),
  channel VARCHAR(1) NOT NULL CHECK (channel IN ('A', 'B')),
  date_entered DATE NOT NULL,
  stock_status VARCHAR(20) DEFAULT 'normal' CHECK (stock_status IN ('normal', 'missing', 'excess')),
  supplier_id INTEGER REFERENCES suppliers(id),
  brand_id INTEGER REFERENCES brands(id),
  invoice_number VARCHAR(100),
  observations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_ean ON inventory(ean);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_company_channel ON inventory(company, channel);

-- Price History
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,
  old_cost_without_tax DECIMAL(10,2),
  new_cost_without_tax DECIMAL(10,2),
  old_pvp_without_tax DECIMAL(10,2),
  new_pvp_without_tax DECIMAL(10,2),
  price_change_percentage DECIMAL(5,2),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_price_history_sku ON price_history(sku);

-- 7. Expenses Management
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  has_invoice BOOLEAN DEFAULT false,
  invoice_number VARCHAR(100),
  invoice_date DATE,
  paid_by INTEGER REFERENCES users(id),
  paid_date DATE,
  payment_method VARCHAR(50) DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'transferencia', 'cheque', 'tarjeta')),
  observations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

-- Expenses Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_run ON recurring_expenses(next_run_date);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_expenses_updated_at ON recurring_expenses;
CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default expense categories
INSERT INTO expense_categories (name, description) VALUES 
  ('Alquiler', 'Gastos de alquiler de local comercial'),
  ('Combustible', 'Gastos de combustible para vehículos'),
  ('Flete', 'Gastos de transporte y envíos'),
  ('Flex', 'Gastos de publicidad y marketing'),
  ('Servicios', 'Servicios públicos (luz, agua, gas, internet)'),
  ('Limpieza', 'Productos y servicios de limpieza'),
  ('Gastos Varios', 'Otros gastos no categorizados')
ON CONFLICT (name) DO NOTHING;

-- 8. Wholesale Management
CREATE TABLE IF NOT EXISTS wholesale_clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    cuit TEXT NOT NULL,
    address TEXT,
    province TEXT,
    city TEXT,
    contact_person TEXT,
    email TEXT,
    whatsapp TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS wholesale_orders (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES wholesale_clients(id) ON DELETE CASCADE,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    is_paid BOOLEAN DEFAULT FALSE,
    collection_status TEXT DEFAULT 'to_collect',
    vendor TEXT,
    CONSTRAINT wholesale_orders_collection_status_chk CHECK (collection_status IN ('to_collect','collected')),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist (for updates)
ALTER TABLE wholesale_orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE wholesale_orders ADD COLUMN IF NOT EXISTS collection_status TEXT DEFAULT 'to_collect';
ALTER TABLE wholesale_orders ADD COLUMN IF NOT EXISTS vendor TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wholesale_orders_collection_status_chk'
  ) THEN
    ALTER TABLE wholesale_orders ADD CONSTRAINT wholesale_orders_collection_status_chk CHECK (collection_status IN ('to_collect','collected'));
  END IF;
END $$;
UPDATE wholesale_orders SET collection_status = COALESCE(collection_status, 'to_collect');
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_collection_status ON wholesale_orders(collection_status);

CREATE TABLE IF NOT EXISTS wholesale_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES wholesale_orders(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_price NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wholesale_vendors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    section TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wholesale_orders_client_id ON wholesale_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_order_items_order_id ON wholesale_order_items(order_id);

-- 8b. Retail Management
CREATE TABLE IF NOT EXISTS retail_clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    dni_cuit TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    province TEXT,
    zip_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_retail_clients_dni_cuit ON retail_clients(dni_cuit);
CREATE INDEX IF NOT EXISTS idx_retail_clients_name ON retail_clients(name);

-- 9. Credit Notes Module
CREATE TABLE IF NOT EXISTS credit_notes (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL,
  supplier TEXT NOT NULL,
  items_count INTEGER NOT NULL DEFAULT 1,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('disponible','utilizada')) DEFAULT 'disponible',
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_number ON credit_notes(number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_supplier ON credit_notes(supplier);
CREATE INDEX IF NOT EXISTS idx_credit_notes_date ON credit_notes(date);

-- 10. Rentabilidad Real Module
-- 10.1 ML Accounts
CREATE TABLE IF NOT EXISTS rt_ml_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  seller_id BIGINT UNIQUE,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  access_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10.2 SKU Mapping
CREATE TABLE IF NOT EXISTS rt_ml_sku_map (
  account_id UUID REFERENCES rt_ml_accounts(id),
  sku TEXT NOT NULL,
  item_id TEXT NOT NULL,
  variation_id BIGINT,
  last_resolved_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  PRIMARY KEY (account_id, sku)
);

-- 10.3 Stock (Updated with title and thumbnail)
CREATE TABLE IF NOT EXISTS rt_stock_current (
  account_id UUID REFERENCES rt_ml_accounts(id),
  sku TEXT NOT NULL,
  qty INTEGER, -- null = not published/found
  status TEXT, -- "Stock"|"Sin stock"|"No publicado"
  title TEXT,
  thumbnail TEXT,
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

-- 10.4 Orders Raw (MercadoLibre)
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
  order_id BIGINT,
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

-- 10.5 Internal Sales Normalization (Generic Sales Model)
CREATE TABLE IF NOT EXISTS rt_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel TEXT NOT NULL, -- 'ML', etc.
  account_id UUID REFERENCES rt_ml_accounts(id),
  external_order_id TEXT,
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

-- 10.6 Profitability Calculation
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

-- 10.7 Jobs (Sync State)
CREATE TABLE IF NOT EXISTS rt_jobs (
  name TEXT PRIMARY KEY,
  cursor JSONB,
  locked_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10.8 Simulator (Pricing Plans)
CREATE TABLE IF NOT EXISTS rt_pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES rt_ml_accounts(id),
  plan TEXT, -- "SIN", "3", "6", "9", "12"
  markup_pct NUMERIC(10, 4),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10.9 Shadow Products (Fallback if no inventory table exists)
CREATE TABLE IF NOT EXISTS rt_products_shadow (
  sku TEXT PRIMARY KEY,
  cost_unit NUMERIC(20, 2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Rentabilidad Module
CREATE INDEX IF NOT EXISTS idx_rt_ml_sku_map_sku ON rt_ml_sku_map(sku);
CREATE INDEX IF NOT EXISTS idx_rt_ml_orders_date ON rt_ml_orders(date_created);
CREATE INDEX IF NOT EXISTS idx_rt_sales_sold_at ON rt_sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_rt_sale_items_sku ON rt_sale_items(sku);
CREATE INDEX IF NOT EXISTS idx_rt_sale_charges_sale_id ON rt_sale_charges(sale_id);

-- 11. Stock Management (Simple Stock)
CREATE TABLE IF NOT EXISTS stock_brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_products (
  id SERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_changes (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES stock_products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  old_quantity INTEGER NOT NULL DEFAULT 0,
  new_quantity INTEGER NOT NULL DEFAULT 0,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_products_sku ON stock_products(sku);
CREATE INDEX IF NOT EXISTS idx_stock_products_brand ON stock_products(brand);
CREATE INDEX IF NOT EXISTS idx_stock_changes_product_id ON stock_changes(product_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_stock_products_updated_at ON stock_products;
CREATE TRIGGER update_stock_products_updated_at
  BEFORE UPDATE ON stock_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_brands_updated_at ON stock_brands;
CREATE TRIGGER update_stock_brands_updated_at
  BEFORE UPDATE ON stock_brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Allow duplicated SKU by dropping unique constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'stock_products_sku_key'
  ) THEN
    ALTER TABLE stock_products DROP CONSTRAINT stock_products_sku_key;
  END IF;
END $$;

-- 12. Initial Data Seed
-- Admin User
INSERT INTO users (
  email, name, password_hash, role, is_active, 
  can_view_logs, can_view_wholesale, can_view_dashboard, can_view_products, 
  can_view_stock, can_view_rentabilidad, can_view_precios, can_view_zentor, 
  can_view_clients, can_view_brands, can_view_suppliers, can_view_wholesale_bullpadel, 
  can_view_retail, can_view_gastos, can_view_compras, can_view_notas_credito, can_view_users
) 
VALUES (
  'maycamadmin@maycam.com', 
  'Administrador MAYCAM', 
  '$2b$12$LQv3c1yAvFnpsIjcLMTuNOHHDJkqP.TaP0gs2GuqbG5vMw/aO.Uy6', -- maycamadmin2025!
  'admin', 
  true, 
  true, true, true, true, 
  true, true, true, true, 
  true, true, true, true, 
  true, true, true, true, true
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  can_view_logs = true,
  can_view_wholesale = true,
  can_view_dashboard = true,
  can_view_products = true,
  can_view_stock = true,
  can_view_rentabilidad = true,
  can_view_precios = true,
  can_view_zentor = true,
  can_view_clients = true,
  can_view_brands = true,
  can_view_suppliers = true,
  can_view_wholesale_bullpadel = true,
  can_view_retail = true,
  can_view_gastos = true,
  can_view_compras = true,
  can_view_notas_credito = true,
  can_view_users = true;

-- Basic Suppliers
INSERT INTO suppliers (name) VALUES 
  ('PROVEEDOR PRINCIPAL'),
  ('DISTRIBUIDOR NACIONAL'),
  ('IMPORTADOR DIRECTO')
ON CONFLICT (name) DO NOTHING;

-- Basic Brands
INSERT INTO brands (name) VALUES 
  ('MARCA PREMIUM'),
  ('MARCA ESTÁNDAR'),
  ('MARCA ECONÓMICA')
ON CONFLICT (name) DO NOTHING;

-- Log the setup
INSERT INTO activity_logs (
  user_id, user_email, user_name, action, description, created_at
) 
SELECT 
  id, email, name, 'SYSTEM_SETUP', 'Database initialized with MASTER_DB_SETUP.sql', NOW()
FROM users 
WHERE email = 'maycamadmin@maycam.com'
LIMIT 1;

NOTIFY pgrst, 'reload config';
