// Shared type definitions for Gitnote

export interface Note {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  word_count?: number;
  status?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Label {
  id: string;
  tag_name: string;
  color: string;
  description: string;
  is_default?: boolean;
  target_path?: string;
}

export interface FolderPath {
  id: string | null;
  path: string;
  alias: string | null;
  is_default: boolean;
}

export interface RepoConnection {
  connected: boolean;
  repoConnection: {
    provider: string;
    repoFullName: string;
    defaultBranch: string;
    basePath: string;
  } | null;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "conflict" | "error";

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, any>;
}
