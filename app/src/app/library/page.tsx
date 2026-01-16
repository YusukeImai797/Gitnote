"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { Note, Label, FolderPath } from "@/types";

type SortBy = 'updated' | 'created' | 'title';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export default function LibraryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [folders, setFolders] = useState<FolderPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Selection state
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Batch operation state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
      const [notesRes, labelsRes, foldersRes] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/labels"),
        fetch("/api/folders"),
      ]);

      const notesData = await notesRes.json();
      const labelsData = await labelsRes.json();
      const foldersData = await foldersRes.json();

      setNotes(notesData.notes || []);
      setLabels(labelsData.labels || []);
      setFolders(foldersData.folders || []);
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

  const getFolderDisplayName = (folder: FolderPath): string => {
    if (folder.alias) return folder.alias;
    const parts = folder.path.split('/').filter(Boolean);
    if (parts.length <= 2) return folder.path;
    return `.../${parts.slice(-2).join('/')}/`;
  };

  const filteredAndSortedNotes = notes
    .filter((note) => {
      const matchesSearch =
        !searchQuery ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !selectedTag || note.tags?.includes(selectedTag);
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created':
          comparison = new Date(a.created_at || a.updated_at || 0).getTime() -
            new Date(b.created_at || b.updated_at || 0).getTime();
          break;
        case 'updated':
        default:
          comparison = new Date(a.updated_at || 0).getTime() -
            new Date(b.updated_at || 0).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Selection handlers
  const toggleNoteSelection = useCallback((noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      if (newSet.size === 0) {
        setIsSelectionMode(false);
      } else {
        setIsSelectionMode(true);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = new Set(filteredAndSortedNotes.map(n => n.id).filter((id): id is string => !!id));
    setSelectedNotes(allIds);
    setIsSelectionMode(true);
  }, [filteredAndSortedNotes]);

  const clearSelection = useCallback(() => {
    setSelectedNotes(new Set());
    setIsSelectionMode(false);
  }, []);

  // Batch operations
  const handleBatchDelete = async () => {
    if (selectedNotes.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/notes/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_ids: Array.from(selectedNotes) }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${data.deletedCount}件のノートを削除しました`);
        if (data.failedCount > 0) {
          toast.warning(`${data.failedCount}件の削除に失敗しました`);
        }
        clearSelection();
        fetchData();
      } else {
        toast.error(data.error || '削除に失敗しました');
      }
    } catch (error) {
      toast.error('削除に失敗しました');
    } finally {
      setIsProcessing(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleBatchMove = async (folderPathId: string) => {
    if (selectedNotes.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/notes/batch/move', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note_ids: Array.from(selectedNotes),
          folder_path_id: folderPathId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${data.movedCount}件のノートを移動しました`);
        if (data.skippedCount > 0) {
          toast.info(`${data.skippedCount}件は既に同じフォルダにありました`);
        }
        clearSelection();
        fetchData();
      } else {
        toast.error(data.error || '移動に失敗しました');
      }
    } catch (error) {
      toast.error('移動に失敗しました');
    } finally {
      setIsProcessing(false);
      setShowMoveModal(false);
    }
  };

  const handleBatchLabels = async (addLabels: string[], removeLabels: string[]) => {
    if (selectedNotes.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/notes/batch/labels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note_ids: Array.from(selectedNotes),
          add_labels: addLabels,
          remove_labels: removeLabels,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${data.updatedCount}件のノートを更新しました`);
        clearSelection();
        fetchData();
      } else {
        toast.error(data.error || '更新に失敗しました');
      }
    } catch (error) {
      toast.error('更新に失敗しました');
    } finally {
      setIsProcessing(false);
      setShowLabelModal(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Redesigned Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-4">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Library
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/")}
                className="p-2 rounded-xl hover:bg-muted transition-colors"
                title="Home"
              >
                <span className="material-symbols-outlined text-[22px] text-muted-foreground">home</span>
              </button>
              <button
                onClick={() => router.push("/editor")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:opacity-90 transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span className="hidden sm:inline">New Note</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground material-symbols-outlined text-[20px]">search</span>
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-subtle border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            {/* Sort & View Controls */}
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="h-10 px-3 rounded-xl border border-border bg-transparent text-sm outline-none focus:border-primary cursor-pointer hover:bg-muted transition-colors"
              >
                <option value="updated">Updated</option>
                <option value="created">Created</option>
                <option value="title">Title</option>
              </select>
              <button
                onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-colors"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                </span>
              </button>
              <button
                onClick={() => setViewMode(mode => mode === 'grid' ? 'list' : 'grid')}
                className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center transition-colors"
                title={viewMode === 'grid' ? 'Grid view' : 'List view'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {viewMode === 'grid' ? 'view_list' : 'grid_view'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Selection Action Bar */}
      {isSelectionMode && (
        <div className="sticky top-[116px] md:top-[124px] z-10 border-b border-primary/20 bg-primary/5 backdrop-blur-sm px-4 py-3 animate-slide-up">
          <div className="mx-auto flex max-w-6xl items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={clearSelection}
                className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <span className="text-sm font-semibold text-primary">
                {selectedNotes.size} selected
              </span>
              <button
                onClick={selectAll}
                className="text-sm text-primary hover:underline underline-offset-2"
              >
                Select all
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMoveModal(true)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">folder</span>
                Move
              </button>
              <button
                onClick={() => setShowLabelModal(true)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">label</span>
                Labels
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-error/10 border border-error/20 text-sm font-medium text-error hover:bg-error/20 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 pb-8">
        {/* Tag Filter Pills */}
        <div className="mb-6 flex flex-wrap gap-2 animate-fade-in">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${selectedTag === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
          >
            All Notes
          </button>
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => setSelectedTag(label.tag_name)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${selectedTag === label.tag_name
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
            >
              <span
                className="w-2 h-2 rounded-full ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: label.color }}
              />
              {label.tag_name}
            </button>
          ))}
        </div>

        {/* Notes Grid/List or Empty State */}
        {filteredAndSortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[40px] text-muted-foreground">note_stack</span>
            </div>
            <h3
              className="text-xl font-semibold mb-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {searchQuery || selectedTag ? "No notes found" : "No notes yet"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {searchQuery || selectedTag
                ? "Try adjusting your search or filter"
                : "Create your first note and start writing"}
            </p>
            {!searchQuery && !selectedTag && (
              <button
                onClick={() => router.push("/editor")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:opacity-90 transition-all active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[20px]">edit_note</span>
                Create Note
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-3'}>
            {filteredAndSortedNotes.map((note, index) => (
              <NoteCard
                key={note.id}
                note={note}
                getLabelColor={getLabelColor}
                onClick={() => {
                  if (isSelectionMode && note.id) {
                    toggleNoteSelection(note.id);
                  } else {
                    router.push(`/editor?id=${note.id}`);
                  }
                }}
                onLongPress={() => note.id && toggleNoteSelection(note.id)}
                isSelected={note.id ? selectedNotes.has(note.id) : false}
                isSelectionMode={isSelectionMode}
                onToggleSelect={(e) => note.id && toggleNoteSelection(note.id, e)}
                viewMode={viewMode}
                animationDelay={index < 10 ? index * 0.03 : 0}
              />
            ))}
          </div>
        )}
      </main>

      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowMoveModal(false)}>
          <div
            className="mx-0 sm:mx-4 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-card p-6 shadow-xl border border-border animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Move to folder
              </h2>
              <button
                onClick={() => setShowMoveModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto -mx-2 px-2">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => folder.id && handleBatchMove(folder.id)}
                  disabled={isProcessing}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-muted flex items-center gap-3 disabled:opacity-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-muted-foreground">folder</span>
                  <span className="font-medium">{getFolderDisplayName(folder)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Label Modal */}
      {showLabelModal && (
        <LabelModal
          labels={labels}
          selectedNotes={selectedNotes}
          notes={notes}
          onClose={() => setShowLabelModal(false)}
          onApply={handleBatchLabels}
          isProcessing={isProcessing}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="mx-0 sm:mx-4 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-card p-6 shadow-xl border border-border animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px] text-error">delete_forever</span>
              </div>
              <div>
                <h2
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Delete notes?
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedNotes.size} note{selectedNotes.size > 1 ? 's' : ''} will be removed
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete the selected notes from GitHub and the database. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Label Modal Component
function LabelModal({
  labels,
  selectedNotes,
  notes,
  onClose,
  onApply,
  isProcessing,
}: {
  labels: Label[];
  selectedNotes: Set<string>;
  notes: Note[];
  onClose: () => void;
  onApply: (add: string[], remove: string[]) => void;
  isProcessing: boolean;
}) {
  const [addLabels, setAddLabels] = useState<Set<string>>(new Set());
  const [removeLabels, setRemoveLabels] = useState<Set<string>>(new Set());

  const toggleAddLabel = (labelName: string) => {
    setAddLabels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(labelName)) {
        newSet.delete(labelName);
      } else {
        newSet.add(labelName);
        // Remove from remove set if present
        setRemoveLabels(r => {
          const nr = new Set(r);
          nr.delete(labelName);
          return nr;
        });
      }
      return newSet;
    });
  };

  const toggleRemoveLabel = (labelName: string) => {
    setRemoveLabels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(labelName)) {
        newSet.delete(labelName);
      } else {
        newSet.add(labelName);
        // Remove from add set if present
        setAddLabels(a => {
          const na = new Set(a);
          na.delete(labelName);
          return na;
        });
      }
      return newSet;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-0 sm:mx-4 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-card p-6 shadow-xl border border-border animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Edit labels
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto -mx-2 px-2">
          {labels.map((label) => (
            <div key={label.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: label.color }}
                />
                <span className="font-medium">{label.tag_name}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleAddLabel(label.tag_name)}
                  className={`p-2 rounded-lg transition-colors ${addLabels.has(label.tag_name)
                      ? 'bg-success/10 text-success'
                      : 'hover:bg-muted text-muted-foreground'
                    }`}
                  title="Add"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <button
                  onClick={() => toggleRemoveLabel(label.tag_name)}
                  className={`p-2 rounded-lg transition-colors ${removeLabels.has(label.tag_name)
                      ? 'bg-error/10 text-error'
                      : 'hover:bg-muted text-muted-foreground'
                    }`}
                  title="Remove"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(Array.from(addLabels), Array.from(removeLabels))}
            disabled={isProcessing || (addLabels.size === 0 && removeLabels.size === 0)}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isProcessing ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Note Card Component
function NoteCard({
  note,
  getLabelColor,
  onClick,
  onLongPress,
  isSelected,
  isSelectionMode,
  onToggleSelect,
  viewMode = 'grid',
  animationDelay = 0,
}: {
  note: Note;
  getLabelColor: (tagName: string) => string;
  onClick: () => void;
  onLongPress: () => void;
  isSelected: boolean;
  isSelectionMode: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  viewMode?: ViewMode;
  animationDelay?: number;
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

  const isListView = viewMode === 'list';

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
      style={{ animationDelay: `${animationDelay}s` }}
      className={`cursor-pointer rounded-2xl bg-card shadow-sm border transition-all animate-fade-in group ${isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border/50 hover:border-border hover:shadow-md'
        } ${isListView ? 'p-4 flex items-center gap-4' : 'p-5 hover:-translate-y-0.5'}`}
    >
      {/* Checkbox */}
      {isSelectionMode && (
        <button
          onClick={onToggleSelect}
          className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected
              ? 'bg-primary border-primary text-primary-foreground scale-110'
              : 'border-border hover:border-primary'
            }`}
        >
          {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
        </button>
      )}

      <div className={`flex items-start justify-between ${isListView ? 'flex-1 min-w-0' : 'mb-3'}`}>
        <h3
          className={`flex-1 font-semibold ${isListView ? 'text-base line-clamp-1' : 'text-lg line-clamp-2'}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {note.title}
        </h3>
        {note.status === "synced" && (
          <span className="material-symbols-outlined text-[18px] text-success flex-shrink-0 ml-2">check_circle</span>
        )}
        {note.status === "syncing" && (
          <span className="material-symbols-outlined text-[18px] text-primary flex-shrink-0 ml-2 animate-spin">sync</span>
        )}
        {note.status === "conflict" && (
          <span className="material-symbols-outlined text-[18px] text-error flex-shrink-0 ml-2">error</span>
        )}
      </div>

      {note.tags && note.tags.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${isListView ? '' : 'mb-3'}`}>
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
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

      <div className={`flex items-center ${isListView ? 'gap-4' : 'justify-between'} text-xs text-muted-foreground ${isListView ? 'flex-shrink-0' : ''}`}>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">article</span>
          {note.word_count} words
        </span>
        <span>{formatDate(note.updated_at || '')}</span>
      </div>
    </div>
  );
}
