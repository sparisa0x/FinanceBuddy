-- 006_wishlist.sql
-- Purpose: Define wishlist table and wishlist indexes.

CREATE TABLE IF NOT EXISTS public.wishlist (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           text NOT NULL,
  category       text DEFAULT 'want',
  estimated_cost numeric NOT NULL,
  priority       text CHECK (priority IN ('low','medium','high')),
  status         text DEFAULT 'added',
  view_count     int DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id       ON public.wishlist(user_id);
