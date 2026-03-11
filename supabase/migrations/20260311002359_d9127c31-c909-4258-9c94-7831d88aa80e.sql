
-- DELETE policy for sentiment_analyses
CREATE POLICY "Users can delete own analyses"
ON public.sentiment_analyses
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- DELETE policy for messages (needed for conversation deletion)
CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
));
