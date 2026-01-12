"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Editor from "@/components/Editor";

interface Note {
  id?: string;
  title: string;
  content: string;
  tags: string[];
}

interface Label {
  id: string;
  tag_name: string;
  color: string;
  description: string;
}

interface FolderPath {
  id: string | null;
  path: string;
  alias: string | null;
  is_default: boolean;
}

type SyncStatus = "idle" | "syncing" | "synced" | "conflict" | "error";

const AUTOSAVE_DELAY = 30000; // 30 seconds

export default function EditorContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const noteId = searchParams.get("id");

  const [note, setNote] = useState<Note>({
    title: "",
    content: "",
    tags: [],
  });
  const [labels, setLabels] = useState<Label[]>([]);
  const [folders, setFolders] = useState<FolderPath[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [remoteContent, setRemoteContent] = useState<string>("");

  // Ref to track if content has changed since last sync
  const hasUnsyncedChanges = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchLabels();
      fetchFolders();
    }
  }, [status, router]);

  const fetchFolders = async () => {
    try {
      const response = await fetch("/api/folders");
      const data = await response.json();
      if (data.folders) {
        setFolders(data.folders);
        // Set default folder if available
        const defaultFolder = data.folders.find((f: FolderPath) => f.is_default);
        if (defaultFolder && defaultFolder.id) {
          setSelectedFolderId(defaultFolder.id);
        } else if (data.folders.length > 0 && data.folders[0].id) {
          setSelectedFolderId(data.folders[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    }
  };

  // Helper to display folder name (alias or truncated path)
  const getFolderDisplayName = (folder: FolderPath): string => {
    if (folder.alias) return folder.alias;
    const parts = folder.path.split('/').filter(Boolean);
    if (parts.length <= 2) return folder.path;
    return `.../${parts.slice(-2).join('/')}/`;
  };

  const fetchLabels = async () => {
    try {
      const response = await fetch("/api/labels");
      const data = await response.json();
      if (data.labels) {
        setLabels(data.labels);
      }
    } catch (error) {
      console.error("Failed to fetch labels:", error);
    }
  };

  useEffect(() => {
    if (noteId && status === "authenticated") {
      loadNote(noteId);
    } else if (status === "authenticated") {
      // Load from localStorage on mount
      const savedNote = localStorage.getItem("draft-note");
      if (savedNote) {
        try {
          const parsed = JSON.parse(savedNote);
          setNote(parsed);
        } catch (error) {
          console.error("Failed to parse saved note:", error);
        }
      }
    }
  }, [noteId, status]);

  const loadNote = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notes/${id}`);
      const data = await response.json();

      if (data.note) {
        setNote({
          id: data.note.id,
          title: data.note.title,
          content: data.content || "",
          tags: data.note.tags || [],
        });
        setSyncStatus("synced");
      }
    } catch (error) {
      console.error("Failed to load note:", error);
      toast.error("Failed to load note");
    } finally {
      setLoading(false);
    }
  };

  // Save to localStorage with 1 second debounce
  const saveToLocalStorage = useCallback(() => {
    localStorage.setItem("draft-note", JSON.stringify(note));
    setLastSaved(new Date());
  }, [note]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (note.title || note.content) {
        saveToLocalStorage();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [note, saveToLocalStorage]);

  // Sync to Git function
  const syncToGit = useCallback(async () => {
    if (!note.id || !note.title || !hasUnsyncedChanges.current) {
      return;
    }

    setSyncStatus("syncing");
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      });

      if (response.status === 409) {
        // Conflict detected
        const data = await response.json();
        setSyncStatus("conflict");
        setRemoteContent(data.remoteContent || "");
        setShowConflictModal(true);
        toast.error("Conflict detected! Please resolve the conflict.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to sync");
      }

      const data = await response.json();
      hasUnsyncedChanges.current = false;
      setSyncStatus("synced");
      toast.success("Synced to Git");

      // Update note with new SHA
      if (data.note) {
        setNote(prev => ({ ...prev, id: data.note.id }));
      }
    } catch (error) {
      console.error("Error syncing to Git:", error);
      setSyncStatus("error");
      toast.error("Failed to sync to Git");
    }
  }, [note]);

  // 30-second auto-save timer
  useEffect(() => {
    // Only start timer for existing notes with unsaved changes
    if (!note.id || !hasUnsyncedChanges.current) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      syncToGit();
    }, AUTOSAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [note.content, note.title, note.tags, note.id, syncToGit]);

  const handleContentChange = (content: string) => {
    setNote((prev) => ({ ...prev, content }));
    hasUnsyncedChanges.current = true;
    if (syncStatus === "synced") {
      setSyncStatus("idle");
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNote((prev) => ({ ...prev, title: e.target.value }));
    hasUnsyncedChanges.current = true;
    if (syncStatus === "synced") {
      setSyncStatus("idle");
    }
  };

  const toggleLabel = (labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    if (!label) return;

    setNote((prev) => {
      const isSelected = prev.tags.includes(label.tag_name);
      return {
        ...prev,
        tags: isSelected
          ? prev.tags.filter((t) => t !== label.tag_name)
          : [...prev.tags, label.tag_name],
      };
    });
    hasUnsyncedChanges.current = true;
  };

  const handleSaveToGit = async () => {
    if (!note.title) {
      toast.error("Please enter a title");
      return;
    }

    setSaving(true);
    setSyncStatus("syncing");
    try {
      let response;

      if (note.id) {
        // Update existing note
        response = await fetch(`/api/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(note),
        });
      } else {
        // Create new note
        response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...note,
            folder_path_id: selectedFolderId,
          }),
        });
      }

      if (response.status === 409) {
        const data = await response.json();
        setSyncStatus("conflict");
        setRemoteContent(data.remoteContent || "");
        setShowConflictModal(true);
        toast.error("Conflict detected! Please resolve the conflict.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save note");
      }

      hasUnsyncedChanges.current = false;
      setSyncStatus("synced");
      toast.success("Note saved to Git!");
      localStorage.removeItem("draft-note");
      router.push("/library");
    } catch (error) {
      console.error("Error saving note:", error);
      setSyncStatus("error");
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  // Handle conflict resolution
  const handleForceOverwrite = async () => {
    if (!note.id) return;

    setSyncStatus("syncing");
    try {
      const response = await fetch(`/api/notes/${note.id}/force`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...note, forceOverwrite: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to force overwrite");
      }

      hasUnsyncedChanges.current = false;
      setSyncStatus("synced");
      setShowConflictModal(false);
      toast.success("Note successfully overwritten");
    } catch (error) {
      console.error("Error force overwriting:", error);
      setSyncStatus("error");
      toast.error("Failed to overwrite");
    }
  };

  const handleUseRemote = async () => {
    if (!note.id) return;

    await loadNote(note.id);
    hasUnsyncedChanges.current = false;
    setSyncStatus("synced");
    setShowConflictModal(false);
    toast.success("Reverted to remote version");
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case "syncing":
        return (
          <svg className="h-4 w-4 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case "synced":
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case "conflict":
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case "error":
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

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
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button
            onClick={() => router.push("/library")}
            className="flex size-10 items-center justify-center rounded-full hover:bg-subtle active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">arrow_back_ios_new</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest">
            {getSyncStatusIcon()}
            <span>
              {syncStatus === "syncing" && "Syncing..."}
              {syncStatus === "synced" && "Synced"}
              {syncStatus === "conflict" && "Conflict"}
              {syncStatus === "error" && "Error"}
              {syncStatus === "idle" && "Drafting"}
            </span>
          </div>
          <button
            onClick={handleSaveToGit}
            disabled={saving}
            className="flex items-center justify-center px-4 py-2 rounded-xl text-primary font-bold hover:bg-primary/10 active:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Done"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Labels - Sample style horizontal scrollable chips */}
        <div className="w-full overflow-x-auto no-scrollbar py-2 mb-4">
          <div className="flex gap-3 w-max">
            {/* Add Tag button */}
            <button className="flex h-9 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-primary/10 pl-3 pr-4 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-primary text-[20px]">add</span>
              <span className="text-primary text-sm font-bold">Add Tag</span>
            </button>
            {labels.map((label) => {
              const isSelected = note.tags.includes(label.tag_name);
              return (
                <button
                  key={label.id}
                  onClick={() => toggleLabel(label.id)}
                  className={`group flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full pl-4 pr-4 shadow-sm hover:shadow-md transition-all active:scale-95 ${isSelected
                      ? 'bg-primary/10 border-2 border-primary/50'
                      : 'bg-card border border-transparent'
                    }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className={`text-sm font-medium transition-colors ${isSelected ? 'text-primary' : 'group-hover:text-primary'}`}>
                    {label.tag_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Folder Selection (only for new notes) */}
        {!note.id && folders.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              保存先フォルダ
            </label>
            <select
              value={selectedFolderId || ""}
              onChange={(e) => setSelectedFolderId(e.target.value || null)}
              className="w-full max-w-md rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            >
              {folders.map((folder) => (
                <option key={folder.id || folder.path} value={folder.id || ""}>
                  {getFolderDisplayName(folder)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Editor Card */}
        <div className="rounded-2xl bg-card p-6 shadow-sm border border-border">
          <input
            type="text"
            value={note.title}
            onChange={handleTitleChange}
            placeholder="Give this thought a name..."
            className="mb-4 w-full border-none pb-3 pt-2 text-[28px] font-bold leading-tight outline-none bg-transparent placeholder:text-muted-foreground/50"
          />
          <Editor
            content={note.content}
            onChange={handleContentChange}
            placeholder="Start writing here..."
          />
        </div>
      </main>

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white dark:bg-card p-6 shadow-xl border border-transparent dark:border-border">
            <div className="mb-4 flex items-center gap-2 text-red-600 dark:text-red-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-lg font-semibold">Conflict Detected</h2>
            </div>
            <p className="mb-6 text-sm text-zinc-600 dark:text-muted-foreground">
              This note has been modified in GitHub since you last synced. Choose how to resolve the conflict:
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleForceOverwrite}
                className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Use my version (overwrite remote)
              </button>
              <button
                onClick={handleUseRemote}
                className="w-full rounded-lg border border-zinc-300 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
              >
                Use remote version (discard my changes)
              </button>
              <button
                onClick={() => setShowConflictModal(false)}
                className="w-full rounded-lg px-4 py-2 text-sm text-zinc-500 dark:text-muted-foreground hover:text-zinc-700 dark:hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
