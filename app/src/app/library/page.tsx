"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Note {
  id: string;
  title: string;
  tags: string[];
  word_count: number;
  status: string;
  updated_at: string;
}

interface Label {
  id: string;
  tag_name: string;
  color: string;
  description: string;
}

export default function LibraryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notesRes, labelsRes] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/labels"),
      ]);

      const notesData = await notesRes.json();
      const labelsData = await labelsRes.json();

      setNotes(notesData.notes || []);
      setLabels(labelsData.labels || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLabelColor = (tagName: string): string => {
    const label = labels.find((l) => l.tag_name === tagName);
    return label?.color || "#6B7280";
  };

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || note.tags?.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-background">
      <header className="border-b border-zinc-200 dark:border-border bg-white dark:bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-semibold">Library</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/editor")}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              New Note
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg border border-zinc-200 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-border bg-transparent px-4 py-2 text-sm outline-none focus:border-violet-500 dark:focus:border-violet-400"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedTag === null
                ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-2 border-violet-500"
                : "bg-zinc-100 dark:bg-muted text-zinc-700 dark:text-zinc-300 border-2 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
          >
            All Notes
          </button>
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => setSelectedTag(label.tag_name)}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedTag === label.tag_name
                  ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-2 border-violet-500"
                  : "bg-zinc-100 dark:bg-muted text-zinc-700 dark:text-zinc-300 border-2 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.tag_name}
            </button>
          ))}
        </div>

        {filteredNotes.length === 0 ? (
          <div className="rounded-lg bg-white dark:bg-card p-12 text-center shadow-sm dark:shadow-lg border border-transparent dark:border-border">
            <p className="text-zinc-500 dark:text-muted-foreground">
              {searchQuery || selectedTag
                ? "No notes found"
                : "No notes yet. Create your first note!"}
            </p>
            {!searchQuery && !selectedTag && (
              <button
                onClick={() => router.push("/editor")}
                className="mt-4 rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Create Note
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                getLabelColor={getLabelColor}
                onClick={() => router.push(`/editor?id=${note.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function NoteCard({
  note,
  getLabelColor,
  onClick,
}: {
  note: Note;
  getLabelColor: (tagName: string) => string;
  onClick: () => void;
}) {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg bg-white dark:bg-card p-4 shadow-sm dark:shadow-lg border border-transparent dark:border-border transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <h3 className="flex-1 text-lg font-semibold line-clamp-2">
          {note.title}
        </h3>
        {note.status === "synced" && (
          <svg
            className="h-5 w-5 flex-shrink-0 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {note.status === "syncing" && (
          <svg
            className="h-5 w-5 flex-shrink-0 animate-spin text-violet-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {note.status === "conflict" && (
          <svg
            className="h-5 w-5 flex-shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}
      </div>

      {note.tags && note.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-muted px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getLabelColor(tag) }}
              />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-muted-foreground">
        <span>{note.word_count} words</span>
        <span>{formatDate(note.updated_at)}</span>
      </div>
    </div>
  );
}
