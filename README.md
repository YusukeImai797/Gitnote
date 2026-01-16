# Gitnote

**Write beautifully. Sync effortlessly. Your markdown notes, powered by Git.**

Gitnote is a stress-free markdown editor that automatically syncs your notes to GitHub. Designed for users who want to write quickly without worrying about manual saves or complex Git operations.

## Features

- ✍️ **Instant Writing** - Start writing immediately with auto-save
- 🔄 **Git Sync** - Your notes are automatically committed to GitHub
- 📂 **Folder Organization** - Organize notes with folders and labels
- 📱 **Mobile-First PWA** - Works great on mobile devices
- 🌙 **Dark Mode** - Easy on the eyes, day or night
- 🔒 **Your Data** - Notes stored in your own GitHub repository

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS v4
- **Editor**: TipTap (WYSIWYG Markdown)
- **Database**: Supabase (PostgreSQL)
- **Auth**: NextAuth.js + GitHub OAuth
- **Sync**: GitHub API (Octokit)
- **Local Storage**: IndexedDB (Dexie.js)

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- GitHub account
- Supabase account

### Installation

```bash
cd app
npm install
npm run dev
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the required values:

- `NEXTAUTH_SECRET`
- `GITHUB_APP_*` credentials
- `NEXT_PUBLIC_SUPABASE_*` credentials

## Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed Vercel deployment instructions.

## Project Structure

```
Gitnote/
├── app/                    # Next.js application
│   ├── src/
│   │   ├── app/           # Pages and API routes
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities and configs
│   └── public/            # Static assets
├── Plan/                   # Documentation and planning
└── DEPLOYMENT_GUIDE.md    # Vercel deployment guide
```

## License

MIT License - see [LICENSE](./LICENSE) for details.