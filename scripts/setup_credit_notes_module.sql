-- Setup Credit Notes module
-- Run this in Supabase SQL Editor

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

NOTIFY pgrst, 'reload config';
