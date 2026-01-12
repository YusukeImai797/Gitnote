create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  github_user_id bigint not null unique,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists repo_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null default 'github',
  repo_full_name text not null,
  default_branch text not null default 'main',
  base_path text not null default '',
  github_installation_id bigint not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repo_connections_status_check check (status in ('active', 'revoked', 'error')),
  unique (user_id, repo_full_name)
);

create table if not exists tag_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  repo_connection_id uuid not null references repo_connections(id) on delete cascade,
  tag_name text not null,
  target_path text not null,
  color text default '#4913EC',
  description text,
  is_default boolean default false,
  github_label_id bigint,
  github_synced boolean default true,
  last_synced_at timestamptz,
  sync_status text default 'synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tag_mappings_sync_status_check check (sync_status in ('synced', 'pending', 'conflict')),
  unique(repo_connection_id, tag_name)
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  repo_connection_id uuid not null references repo_connections(id) on delete cascade,
  tag_mapping_id uuid references tag_mappings(id) on delete set null,
  title text not null default 'Untitled',
  path text not null,
  tags text[] not null default '{}',
  word_count integer not null default 0,
  last_commit_sha text,
  status text not null default 'synced',
  conflict_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_status_check check (status in ('synced', 'syncing', 'conflict', 'error')),
  unique (repo_connection_id, path)
);

create table if not exists sync_jobs (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  state text not null default 'queued',
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_jobs_state_check check (state in ('queued', 'running', 'succeeded', 'failed'))
);

create index if not exists repo_connections_user_id_idx on repo_connections (user_id);
create index if not exists tag_mappings_user_id_idx on tag_mappings (user_id);
create index if not exists tag_mappings_repo_connection_id_idx on tag_mappings (repo_connection_id);
create index if not exists tag_mappings_github_label_id_idx on tag_mappings (github_label_id);
create index if not exists notes_user_updated_at_idx on notes (user_id, updated_at desc);
create index if not exists notes_tags_gin_idx on notes using gin (tags);
create index if not exists notes_title_idx on notes (title);
create index if not exists sync_jobs_note_id_idx on sync_jobs (note_id);

drop trigger if exists set_updated_at_users on users;
create trigger set_updated_at_users
before update on users
for each row execute function set_updated_at();

drop trigger if exists set_updated_at_repo_connections on repo_connections;
create trigger set_updated_at_repo_connections
before update on repo_connections
for each row execute function set_updated_at();

drop trigger if exists set_updated_at_tag_mappings on tag_mappings;
create trigger set_updated_at_tag_mappings
before update on tag_mappings
for each row execute function set_updated_at();

drop trigger if exists set_updated_at_notes on notes;
create trigger set_updated_at_notes
before update on notes
for each row execute function set_updated_at();

drop trigger if exists set_updated_at_sync_jobs on sync_jobs;
create trigger set_updated_at_sync_jobs
before update on sync_jobs
for each row execute function set_updated_at();
