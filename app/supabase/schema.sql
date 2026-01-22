-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Repository connections table
CREATE TABLE IF NOT EXISTS repo_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'github',
  github_installation_id INTEGER NOT NULL,
  repo_full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  base_path TEXT NOT NULL DEFAULT 'notes',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, repo_full_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_repo_connections_user_id ON repo_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_repo_connections_status ON repo_connections(status);

-- Folder paths table
CREATE TABLE IF NOT EXISTS folder_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo_connection_id UUID NOT NULL REFERENCES repo_connections(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repo_connection_id, path)
);

-- Create indexes for folder_paths
CREATE INDEX IF NOT EXISTS idx_folder_paths_repo_connection_id ON folder_paths(repo_connection_id);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_connection_id UUID REFERENCES repo_connections(id) ON DELETE CASCADE,
  folder_path_id UUID REFERENCES folder_paths(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  path TEXT,
  tags TEXT[] DEFAULT '{}',
  word_count INTEGER DEFAULT 0,
  last_commit_sha TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_repo_connection_id ON notes(repo_connection_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_path_id ON notes(folder_path_id);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);

-- Drafts table (for auto-saving unsaved notes)
CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_connection_id UUID NOT NULL REFERENCES repo_connections(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  folder_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, repo_connection_id, note_id)
);

-- Create indexes for drafts
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_repo_connection_id ON drafts(repo_connection_id);
CREATE INDEX IF NOT EXISTS idx_drafts_note_id ON drafts(note_id);

-- Tag mappings table (for GitHub label sync)
CREATE TABLE IF NOT EXISTS tag_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_connection_id UUID NOT NULL REFERENCES repo_connections(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  target_path TEXT,
  color TEXT,
  description TEXT,
  github_label_id BIGINT,
  github_synced BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repo_connection_id, tag_name)
);

-- Create indexes for tag_mappings
CREATE INDEX IF NOT EXISTS idx_tag_mappings_user_id ON tag_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_tag_mappings_repo_connection_id ON tag_mappings(repo_connection_id);
CREATE INDEX IF NOT EXISTS idx_tag_mappings_tag_name ON tag_mappings(tag_name);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users (using service role for now, can be refined later)
CREATE POLICY "Enable all access for service role" ON users
  FOR ALL
  USING (true);

-- RLS Policies for repo_connections
CREATE POLICY "Enable all access for service role" ON repo_connections
  FOR ALL
  USING (true);

-- RLS Policies for folder_paths
CREATE POLICY "Enable all access for service role" ON folder_paths
  FOR ALL
  USING (true);

-- RLS Policies for notes
CREATE POLICY "Enable all access for service role" ON notes
  FOR ALL
  USING (true);

-- RLS Policies for drafts
CREATE POLICY "Enable all access for service role" ON drafts
  FOR ALL
  USING (true);

-- RLS Policies for tag_mappings
CREATE POLICY "Enable all access for service role" ON tag_mappings
  FOR ALL
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repo_connections_updated_at
  BEFORE UPDATE ON repo_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folder_paths_updated_at
  BEFORE UPDATE ON folder_paths
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drafts_updated_at
  BEFORE UPDATE ON drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tag_mappings_updated_at
  BEFORE UPDATE ON tag_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
