-- Create settings table for rider distribution and product expiry configuration
CREATE TABLE IF NOT EXISTS public.distribution_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  default_quantity INT NOT NULL DEFAULT 5 CHECK (default_quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rider_id, product_id)
);

-- Create table for global default distribution quantities
CREATE TABLE IF NOT EXISTS public.global_distribution_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  default_quantity INT NOT NULL DEFAULT 5 CHECK (default_quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- Create table for product expiry date settings
CREATE TABLE IF NOT EXISTS public.product_expiry_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  default_shelf_life_days INT NOT NULL DEFAULT 7 CHECK (default_shelf_life_days > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_distribution_settings_rider_id ON public.distribution_settings(rider_id);
CREATE INDEX IF NOT EXISTS idx_distribution_settings_product_id ON public.distribution_settings(product_id);
CREATE INDEX IF NOT EXISTS idx_global_distribution_defaults_product_id ON public.global_distribution_defaults(product_id);
CREATE INDEX IF NOT EXISTS idx_product_expiry_settings_product_id ON public.product_expiry_settings(product_id);
