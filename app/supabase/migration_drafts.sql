-- Migration: Add drafts table for multi-device draft syncing
-- Run this in Supabase SQL Editor

-- Create drafts table
CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_connection_id UUID NOT NULL REFERENCES repo_connections(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  folder_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, repo_connection_id, note_id)
);

-- Allow null note_id for new drafts that haven't been saved to notes yet
CREATE UNIQUE INDEX drafts_user_repo_null_note_unique
ON drafts (user_id, repo_connection_id)
WHERE note_id IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS drafts_user_id_idx ON drafts (user_id);
CREATE INDEX IF NOT EXISTS drafts_repo_connection_id_idx ON drafts (repo_connection_id);
CREATE INDEX IF NOT EXISTS drafts_note_id_idx ON drafts (note_id);
CREATE INDEX IF NOT EXISTS drafts_updated_at_idx ON drafts (updated_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at_drafts ON drafts;
CREATE TRIGGER set_updated_at_drafts
BEFORE UPDATE ON drafts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Automatically clean up old drafts (optional - adjust retention as needed)
-- Drafts older than 30 days will be deleted
CREATE OR REPLACE FUNCTION cleanup_old_drafts()
RETURNS void AS $$
BEGIN
  DELETE FROM drafts
  WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
