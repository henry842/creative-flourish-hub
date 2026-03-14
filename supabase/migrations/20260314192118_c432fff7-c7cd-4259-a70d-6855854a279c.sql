
-- Table: scheduled_briefs
CREATE TABLE public.scheduled_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  schedule_time time NOT NULL DEFAULT '08:00',
  is_active boolean NOT NULL DEFAULT true,
  include_news boolean NOT NULL DEFAULT true,
  include_macro boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled_briefs" ON public.scheduled_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scheduled_briefs" ON public.scheduled_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled_briefs" ON public.scheduled_briefs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled_briefs" ON public.scheduled_briefs FOR DELETE USING (auth.uid() = user_id);

-- Table: daily_briefs
CREATE TABLE public.daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  tickers text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_briefs" ON public.daily_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_briefs" ON public.daily_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_briefs" ON public.daily_briefs FOR DELETE USING (auth.uid() = user_id);

-- Allow service role to insert daily_briefs (for cron/edge function)
CREATE POLICY "Service can insert daily_briefs" ON public.daily_briefs FOR INSERT WITH CHECK (true);

-- Table: scheduled_brief_assets
CREATE TABLE public.scheduled_brief_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_brief_id uuid NOT NULL REFERENCES public.scheduled_briefs(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scheduled_brief_id, asset_id)
);

ALTER TABLE public.scheduled_brief_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled_brief_assets" ON public.scheduled_brief_assets FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.scheduled_briefs sb WHERE sb.id = scheduled_brief_id AND sb.user_id = auth.uid()));
CREATE POLICY "Users can insert own scheduled_brief_assets" ON public.scheduled_brief_assets FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.scheduled_briefs sb WHERE sb.id = scheduled_brief_id AND sb.user_id = auth.uid()));
CREATE POLICY "Users can delete own scheduled_brief_assets" ON public.scheduled_brief_assets FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.scheduled_briefs sb WHERE sb.id = scheduled_brief_id AND sb.user_id = auth.uid()));
