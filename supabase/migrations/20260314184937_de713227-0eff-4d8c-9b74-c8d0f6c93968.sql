
-- Create assets table
CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  ticker text,
  asset_type text NOT NULL DEFAULT 'outro',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own assets" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE USING (auth.uid() = user_id);

-- Add asset_id FK to documents
ALTER TABLE public.documents ADD COLUMN asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

-- Add asset_id FK to health_scores
ALTER TABLE public.health_scores ADD COLUMN asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

-- Add asset_id FK to conversations
ALTER TABLE public.conversations ADD COLUMN asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;
