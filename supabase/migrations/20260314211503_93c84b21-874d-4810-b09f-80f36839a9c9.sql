-- Security logs table
CREATE TABLE public.security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  details text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- No user can read security logs (admin only via service role)
CREATE POLICY "No public access to security_logs"
  ON public.security_logs
  FOR ALL
  TO public
  USING (false);

-- Storage policies for documents bucket
-- Users can only upload to their own folder
CREATE POLICY "Users upload to own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can only read their own files
CREATE POLICY "Users read own files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own files
CREATE POLICY "Users delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
