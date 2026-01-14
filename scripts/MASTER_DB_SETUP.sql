-- MASTER DATABASE SETUP SCRIPT FOR SISTEMA 2026
-- This script sets up the entire database schema, including users, inventory, expenses, and wholesale management.
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
  updated_by INTEGER REFERENCES users(id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_rentabilidad BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_precios BOOLEAN DEFAULT false;

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
INSERT INTO config (id, iva_percentage, wholesale_percentage_1, wholesale_percentage_2, wholesale_percentage_3) 
VALUES (1, 21.00, 10.00, 17.00, 25.00) 
ON CONFLICT (id) DO UPDATE SET
  wholesale_percentage_1 = EXCLUDED.wholesale_percentage_1,
  wholesale_percentage_2 = EXCLUDED.wholesale_percentage_2,
  wholesale_percentage_3 = EXCLUDED.wholesale_percentage_3;

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

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
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
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure is_paid column exists (for updates)
ALTER TABLE wholesale_orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

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

-- 9. Initial Data Seed (Admin User)
-- Password: maycamadmin2025!
INSERT INTO users (email, name, password_hash, role, is_active, can_view_logs, can_view_wholesale) 
VALUES (
  'maycamadmin@maycam.com', 
  'Administrador MAYCAM', 
  '$2b$12$LQv3c1yAvFnpsIjcLMTuNOHHDJkqP.TaP0gs2GuqbG5vMw/aO.Uy6', 
  'admin', 
  true, 
  true,
  true
) ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  can_view_logs = true,
  can_view_wholesale = true;

-- 10. Stock Management
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

-- 11. Maintenance
-- VACUUM ANALYZE; -- Commented out because it cannot run inside a transaction block in Supabase SQL Editor

-- Log the setup
INSERT INTO activity_logs (
  user_id, user_email, user_name, action, description, created_at
) 
SELECT 
  id, email, name, 'SYSTEM_SETUP', 'Database initialized with MASTER_DB_SETUP.sql', NOW()
FROM users 
WHERE email = 'maycamadmin@maycam.com'
LIMIT 1;
