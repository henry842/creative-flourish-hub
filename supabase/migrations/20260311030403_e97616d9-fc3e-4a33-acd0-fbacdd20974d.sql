
CREATE TABLE public.groq_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.groq_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.groq_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert usage"
  ON public.groq_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can update usage"
  ON public.groq_usage FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for live counter updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.groq_usage;
