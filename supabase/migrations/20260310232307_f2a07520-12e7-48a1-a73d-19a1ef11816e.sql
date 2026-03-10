
-- Add price target columns to health_scores
ALTER TABLE public.health_scores
  ADD COLUMN IF NOT EXISTS price_target_low INTEGER,
  ADD COLUMN IF NOT EXISTS price_target_high INTEGER,
  ADD COLUMN IF NOT EXISTS price_target_rationale TEXT;

-- Create watchlist table
CREATE TABLE public.watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, ticker)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist" ON public.watchlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist" ON public.watchlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist" ON public.watchlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
