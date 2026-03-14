
-- Drop the overly permissive policy and replace with service-role-only approach
-- The edge function uses service role key directly, so authenticated users only need their own policy
DROP POLICY "Service can insert daily_briefs" ON public.daily_briefs;
