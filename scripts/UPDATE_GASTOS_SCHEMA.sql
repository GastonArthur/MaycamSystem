-- UPDATE SCRIPT FOR GASTOS MODULE
-- Run this in Supabase SQL Editor

-- 1. Add new columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN DEFAULT false;

-- 2. Add budget_limit to expense_categories
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS budget_limit DECIMAL(10,2) DEFAULT 0;

-- 3. Create recurring_expenses table
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  next_run_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  payment_method VARCHAR(50) DEFAULT 'efectivo',
  paid_by INTEGER REFERENCES users(id),
  observations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

-- Trigger for recurring_expenses updated_at
DROP TRIGGER IF EXISTS update_recurring_expenses_updated_at ON recurring_expenses;
CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_run ON recurring_expenses(next_run_date);
