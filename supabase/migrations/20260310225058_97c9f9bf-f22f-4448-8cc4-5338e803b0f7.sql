
CREATE TABLE public.health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  ticker text,
  overall_score integer NOT NULL DEFAULT 0,
  revenue_growth integer NOT NULL DEFAULT 0,
  net_margin integer NOT NULL DEFAULT 0,
  debt_level integer NOT NULL DEFAULT 0,
  earnings_quality integer NOT NULL DEFAULT 0,
  regulatory_risk integer NOT NULL DEFAULT 0,
  red_flags jsonb DEFAULT '[]'::jsonb,
  timeline_events jsonb DEFAULT '[]'::jsonb,
  summary text,
  sentiment text DEFAULT 'neutral',
  confidence numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health scores"
  ON public.health_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health scores"
  ON public.health_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health scores"
  ON public.health_scores FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
