-- Create canteen enum type
CREATE TYPE canteen_type AS ENUM ('Kantin Garuda', 'Kantin BTB AU');

-- Create canteen_sales table
CREATE TABLE public.canteen_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen canteen_type NOT NULL,
  cups_sold INTEGER NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.canteen_sales ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Allow public read access on canteen_sales" ON public.canteen_sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on canteen_sales" ON public.canteen_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on canteen_sales" ON public.canteen_sales FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on canteen_sales" ON public.canteen_sales FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_canteen_sales_canteen ON public.canteen_sales(canteen);
CREATE INDEX idx_canteen_sales_date ON public.canteen_sales(sale_date);
CREATE INDEX idx_canteen_sales_created_at ON public.canteen_sales(created_at);
