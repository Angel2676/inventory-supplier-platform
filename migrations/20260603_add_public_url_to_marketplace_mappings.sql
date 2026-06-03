ALTER TABLE marketplace_mappings
ADD COLUMN IF NOT EXISTS public_url TEXT;
