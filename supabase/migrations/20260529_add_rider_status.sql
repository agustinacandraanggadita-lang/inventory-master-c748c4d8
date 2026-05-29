-- Add is_active column to riders table for tracking active/inactive riders
ALTER TABLE public.riders
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add updated_at column if not exists
ALTER TABLE public.riders
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_riders_is_active ON public.riders(is_active);
