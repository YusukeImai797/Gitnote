-- Migration: Add folder_paths table for folder alias system
-- Run this in Supabase SQL Editor

-- Create folder_paths table
CREATE TABLE IF NOT EXISTS folder_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_connection_id UUID NOT NULL REFERENCES repo_connections(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  alias TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(repo_connection_id, path)
);

-- Add folder_path_id to notes table (nullable for backward compatibility)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_path_id UUID REFERENCES folder_paths(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS folder_paths_user_id_idx ON folder_paths (user_id);
CREATE INDEX IF NOT EXISTS folder_paths_repo_connection_id_idx ON folder_paths (repo_connection_id);
CREATE INDEX IF NOT EXISTS notes_folder_path_id_idx ON notes (folder_path_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at_folder_paths ON folder_paths;
CREATE TRIGGER set_updated_at_folder_paths
BEFORE UPDATE ON folder_paths
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Migrate existing data: Create folder_paths from unique target_paths in tag_mappings
INSERT INTO folder_paths (user_id, repo_connection_id, path, is_default)
SELECT DISTINCT 
  tm.user_id,
  tm.repo_connection_id,
  tm.target_path,
  tm.is_default
FROM tag_mappings tm
WHERE tm.deleted_at IS NULL
  AND tm.target_path IS NOT NULL
  AND tm.target_path != ''
ON CONFLICT (repo_connection_id, path) DO NOTHING;
