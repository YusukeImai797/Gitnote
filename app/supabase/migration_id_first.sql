-- Migration: Add content column to notes table for ID-first architecture
-- Run this in Supabase SQL Editor

-- Add content column to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- Add folder_path_id column if not exists
ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_path_id UUID REFERENCES folder_paths(id);

-- Add repo_connection_id if not exists
ALTER TABLE notes ADD COLUMN IF NOT EXISTS repo_connection_id UUID REFERENCES repo_connections(id);

-- Create index for faster content searches
CREATE INDEX IF NOT EXISTS idx_notes_content ON notes USING GIN(to_tsvector('simple', content));
