ALTER TABLE marketplace_listings
ADD COLUMN IF NOT EXISTS public_url TEXT;
