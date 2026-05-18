-- ============================================
-- SUPABASE SQL EDITOR - CANTEEN SALES TABLE
-- ============================================
-- Salin seluruh script ini ke SQL Editor Supabase
-- Langkah:
-- 1. Buka https://app.supabase.com
-- 2. Masuk ke project Anda
-- 3. Klik "SQL Editor" di menu kiri
-- 4. Klik "New Query"
-- 5. Salin-paste seluruh script ini
-- 6. Klik "Run" atau Ctrl+Enter
-- ============================================

-- Step 1: Create enum type untuk canteen
CREATE TYPE canteen_type AS ENUM ('Kantin Garuda', 'Kantin BTB AU');

-- Step 2: Create tabel canteen_sales
CREATE TABLE public.canteen_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen canteen_type NOT NULL,
  cups_sold INTEGER NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: Enable RLS (Row Level Security)
ALTER TABLE public.canteen_sales ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies untuk public access
CREATE POLICY "Allow public read access on canteen_sales" 
  ON public.canteen_sales 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access on canteen_sales" 
  ON public.canteen_sales 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update access on canteen_sales" 
  ON public.canteen_sales 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete access on canteen_sales" 
  ON public.canteen_sales 
  FOR DELETE 
  USING (true);

-- Step 5: Create indexes untuk performance
CREATE INDEX idx_canteen_sales_canteen ON public.canteen_sales(canteen);
CREATE INDEX idx_canteen_sales_date ON public.canteen_sales(sale_date);
CREATE INDEX idx_canteen_sales_created_at ON public.canteen_sales(created_at);

-- ============================================
-- SELESAI! Script sudah ready.
-- ============================================
-- Jika ingin test insert data, gunakan query ini:
-- INSERT INTO canteen_sales (canteen, cups_sold, sale_date) 
-- VALUES ('Kantin Garuda', 50, '2026-05-18');
-- ============================================
