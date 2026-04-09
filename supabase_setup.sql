-- Run this query in your Supabase SQL Editor to enable full Document Synchronization!

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT
);

-- Ensure is_public column exists
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Enable RLS (Row Level Security) so users only see their own docs
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Migration: Drop old policy if exists
DROP POLICY IF EXISTS "Users can only see their own documents" ON documents;
DROP POLICY IF EXISTS "Users can see their own documents or public ones" ON documents;

CREATE POLICY "Users can see their own documents or public ones"
ON documents FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert their own documents"
ON documents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON documents FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON documents FOR DELETE TO authenticated
USING (auth.uid() = user_id);
