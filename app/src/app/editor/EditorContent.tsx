"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { SyncStatusDisplay } from "@/components/SyncStatusIcon";
import { saveLocalNote, getLocalNote, markNoteSynced, saveSyncedNote } from "@/lib/local-db";
import type { Note, Label, FolderPath, SyncStatus } from "@/types";

// Dynamic imports to reduce initial bundle size
const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[350px] flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading editor...</div>
    </div>
  ),
});

const KeyboardShortcutsModal = dynamic(() => import("@/components/KeyboardShortcutsModal"), {
  ssr: false,
});

const AUTOSAVE_DELAY = 30000; // 30 seconds for Git sync
const LOCAL_SAVE_DELAY = 1000; // 1 second for IndexedDB
const CLOUD_SAVE_DELAY = 3000; // 3 seconds for Supabase

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
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [remoteContent, setRemoteContent] = useState<string>("");
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isMovingFolder, setIsMovingFolder] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Ref to track if content has changed since last sync
  const hasUnsyncedChanges = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const localSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cloudSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialFolderIdRef = useRef<string | null>(null);
  // Refs to prevent infinite loops during init
  const isCreatingDraft = useRef(false);
  const isLoadingNote = useRef(false);
  const isResolvingConflict = useRef(false);
  // BroadcastChannel for multi-tab detection
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>(Date.now().toString());

  // Online/Offline detection with auto-sync on resume
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);

      // Auto-sync unsaved changes when coming back online
      if (note.id && hasUnsyncedChanges.current) {
        try {
          const response = await fetch(`/api/notes/${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: note.title,
              content: note.content,
              tags: note.tags,
              saveToDbOnly: true,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const serverUpdatedAt = new Date(data.note?.updated_at || Date.now()).getTime();
            await markNoteSynced(note.id, serverUpdatedAt);
            hasUnsyncedChanges.current = false;
            toast.success("オンラインに復帰しました。変更を同期しました。");
          } else {
            toast.warning("オンラインに復帰しましたが、同期に失敗しました。");
          }
        } catch (error) {
          console.error('[SYNC] Failed to sync on online resume:', error);
          toast.warning("オンラインに復帰しましたが、同期に失敗しました。");
        }
      } else {
        toast.success("オンラインに復帰しました");
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("オフラインです。変更はローカルに保存されます");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [note.id, note.title, note.content, note.tags]);

  // Multi-tab detection using BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel('gitnote-editor-sync');
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, noteId, tabId, content } = event.data;

      // Ignore messages from self
      if (tabId === tabIdRef.current) return;

      if (type === 'NOTE_EDITING' && noteId === note.id) {
        toast.warning("このノートは別のタブでも編集されています");
      }

      if (type === 'NOTE_SAVED' && noteId === note.id) {
        // Another tab saved this note - check if we need to update
        const localContent = note.content;
        if (content !== localContent && !hasUnsyncedChanges.current) {
          // Update our content to match
          setNote(prev => ({ ...prev, content }));
          toast.info("別のタブからの変更を反映しました");
        }
      }
    };

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [note.id, note.content]);

  // Notify other tabs when editing
  useEffect(() => {
    if (!note.id || !broadcastChannelRef.current) return;

    // Debounce: only notify when user is actively typing
    const notifyOtherTabs = () => {
      broadcastChannelRef.current?.postMessage({
        type: 'NOTE_EDITING',
        noteId: note.id,
        tabId: tabIdRef.current,
      });
    };

    // Notify on content change (debounced by the effect itself)
    if (hasUnsyncedChanges.current) {
      notifyOtherTabs();
    }
  }, [note.id, note.content]);

  // Keyboard shortcut to show help (?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          e.preventDefault();
          setShowShortcutsModal(true);
        }
      }
      if (e.key === 'Escape') {
        setShowShortcutsModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save content before page unload or navigation
  useEffect(() => {
    // Immediate save function - prioritizes cloud save for multi-device sync
    const saveImmediately = async () => {
      if (!note.id || (!note.title && !note.content)) return;

      console.log('[SYNC] saveImmediately: Starting...');
      try {
        if (isOnline) {
          // Save to cloud FIRST for multi-device sync
          console.log('[SYNC] saveImmediately: Saving to cloud...');
          const response = await fetch(`/api/notes/${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: note.title,
              content: note.content,
              tags: note.tags,
              saveToDbOnly: true,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const serverUpdatedAt = new Date(data.note?.updated_at || Date.now()).getTime();
            console.log('[SYNC] saveImmediately: Cloud save success, serverUpdatedAt:', serverUpdatedAt);
            // Update local cache with synced state
            await saveSyncedNote({
              id: note.id,
              title: note.title,
              content: note.content,
              tags: note.tags,
              folderPathId: selectedFolderId,
            }, serverUpdatedAt);
            hasUnsyncedChanges.current = false;
          } else {
            console.error('[SYNC] saveImmediately: Cloud save failed, saving to local only');
            await saveLocalNote({
              id: note.id,
              title: note.title,
              content: note.content,
              tags: note.tags,
              folderPathId: selectedFolderId,
            });
          }
        } else {
          // Offline: save to local only
          console.log('[SYNC] saveImmediately: Offline, saving to local only');
          await saveLocalNote({
            id: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags,
            folderPathId: selectedFolderId,
          });
        }
      } catch (error) {
        console.error('[SYNC] saveImmediately: Failed:', error);
        // Fallback: try local save
        try {
          await saveLocalNote({
            id: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags,
            folderPathId: selectedFolderId,
          });
        } catch (localError) {
          console.error('[SYNC] saveImmediately: Local fallback also failed:', localError);
        }
      }
    };

    // Handle page visibility change (when switching tabs/apps)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden' && hasUnsyncedChanges.current) {
        saveImmediately();
      } else if (document.visibilityState === 'visible' && note.id && isOnline) {
        // Skip conflict check if modal is already showing or conflict is being resolved
        if (showConflictModal || isResolvingConflict.current) {
          console.log('[SYNC] Visibility change: Skipping check, conflict resolution in progress');
          return;
        }

        // When returning to foreground, check if server has newer content
        try {
          const response = await fetch(`/api/notes/${note.id}`);
          if (!response.ok) return;

          const data = await response.json();
          if (!data.note) return;

          const serverUpdatedAt = new Date(data.note.updated_at || 0).getTime();
          const localNote = await getLocalNote(note.id);

          const serverContent = data.content || data.note.content || "";

          if (localNote) {
            const cacheIsStale = localNote.syncedAt < serverUpdatedAt;
            const contentDiffers = localNote.content !== serverContent;

            console.log('[SYNC] Visibility change check:', {
              serverUpdatedAt,
              localSyncedAt: localNote.syncedAt,
              cacheIsStale,
              contentDiffers,
            });

            if (!contentDiffers) {
              // Content is the same - just update syncedAt silently
              if (cacheIsStale) {
                await markNoteSynced(note.id, serverUpdatedAt);
              }
            } else if (cacheIsStale) {
              // Server updated AND content differs = conflict
              console.log('[SYNC] Foreground: Conflict detected');
              setRemoteContent(serverContent);
              setSyncStatus("conflict");
              setShowConflictModal(true);
            } else {
              // Content differs but server is not newer - local changes pending
              // Do nothing, user's local changes take priority
              console.log('[SYNC] Foreground: Local changes pending, keeping local');
            }
          } else {
            // No local note - cache the server content
            console.log('[SYNC] Visibility change: No local note, caching server content');
            await saveSyncedNote({
              id: note.id,
              title: data.note.title,
              content: serverContent,
              tags: data.note.tags || [],
              folderPathId: data.note.folder_path_id,
            }, serverUpdatedAt);
          }
        } catch (error) {
          console.error('[SYNC] Visibility check failed:', error);
        }
      }
    };

    // Handle page unload (when closing or navigating away)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsyncedChanges.current) {
        saveImmediately();
        // Show browser's default "unsaved changes" dialog
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [note, selectedFolderId, isOnline, showConflictModal]);

  // Save last opened note ID to localStorage
  useEffect(() => {
    if (note.id) {
      localStorage.setItem('lastOpenedNoteId', note.id);
    }
  }, [note.id]);

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

  // Initialize note - either load existing or create new draft
  useEffect(() => {
    if (status !== "authenticated") return;
    // Prevent re-triggering during draft creation or note loading
    if (isCreatingDraft.current || isLoadingNote.current) return;

    const initializeNote = async () => {
      if (noteId) {
        // Load existing note - skip if already loaded
        if (!isLoadingNote.current) {
          await loadNote(noteId);
        }
      } else {
        // Check for last opened note or create new draft
        const lastNoteId = localStorage.getItem('lastOpenedNoteId');
        if (lastNoteId) {
          // Redirect to last opened note
          router.replace(`/editor?id=${lastNoteId}`);
        } else if (!isCreatingDraft.current) {
          // Create new draft with immediate ID assignment
          await createNewDraft();
        }
      }
    };

    initializeNote();
  }, [noteId, status]);

  const createNewDraft = async () => {
    // Prevent re-entry
    if (isCreatingDraft.current) return;
    isCreatingDraft.current = true;

    try {
      // Don't send folder_path_id - let API use default folder
      const response = await fetch('/api/notes/create-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create draft');
      }

      const data = await response.json();
      if (data.note) {
        setNote({
          id: data.note.id,
          title: data.note.title || 'Untitled Note',
          content: data.note.content || '',
          tags: data.note.tags || [],
        });
        setSelectedFolderId(data.note.folder_path_id);
        initialFolderIdRef.current = data.note.folder_path_id;
        // Update URL with new note ID
        router.replace(`/editor?id=${data.note.id}`);
      }
    } catch (error) {
      console.error('Failed to create draft:', error);
      toast.error('ドラフトの作成に失敗しました');
    } finally {
      isCreatingDraft.current = false;
    }
  };

  const loadNote = async (id: string) => {
    // Prevent re-entry
    if (isLoadingNote.current) return;
    isLoadingNote.current = true;

    setLoading(true);
    try {
      // First check IndexedDB for local changes
      const localNote = await getLocalNote(id);

      const response = await fetch(`/api/notes/${id}`);
      const data = await response.json();

      if (data.note) {
        const serverContent = data.content || data.note.content || "";
        const serverUpdatedAt = new Date(data.note.updated_at || 0).getTime();

        // Simplified content-based sync logic:
        // 1. If content is the same → use server (update syncedAt)
        // 2. If content differs AND server is newer → show conflict UI
        // 3. If content differs AND server is NOT newer → use local

        let useLocal = false;
        let showConflict = false;

        if (localNote) {
          const cacheIsStale = localNote.syncedAt < serverUpdatedAt;
          const contentDiffers = localNote.content !== serverContent;

          // Debug logging
          console.log('[SYNC] loadNote decision:', {
            noteId: id,
            localSyncedAt: localNote.syncedAt,
            serverUpdatedAt,
            cacheIsStale,
            contentDiffers,
            localContentPreview: localNote.content?.substring(0, 50),
            serverContentPreview: serverContent?.substring(0, 50),
          });

          if (!contentDiffers) {
            // Content is the same - use server version
            // syncedAt will be updated via saveSyncedNote below
            console.log('[SYNC] Decision: Use server (content identical)');
            useLocal = false;
          } else if (cacheIsStale) {
            // Server was updated AND content differs = conflict
            console.log('[SYNC] Decision: Conflict detected');
            showConflict = true;
            // Store remote content for conflict UI
            setRemoteContent(serverContent);
          } else {
            // Server is NOT newer, but content differs = local has unsaved changes
            console.log('[SYNC] Decision: Use local (local changes pending)');
            useLocal = true;
          }
        } else {
          console.log('[SYNC] No local note found, using server');
        }

        if (showConflict) {
          // Show conflict modal - let user choose
          setNote({
            id: data.note.id,
            title: localNote!.title,
            content: localNote!.content,
            tags: localNote!.tags,
          });
          setSelectedFolderId(data.note.folder_path_id);
          initialFolderIdRef.current = data.note.folder_path_id;
          setSyncStatus("conflict");
          setShowConflictModal(true);
          hasUnsyncedChanges.current = true;
        } else {
          const finalTitle = useLocal && localNote ? localNote.title : data.note.title;
          const finalContent = useLocal && localNote ? localNote.content : serverContent;
          const finalTags = useLocal && localNote ? localNote.tags : (data.note.tags || []);

          setNote({
            id: data.note.id,
            title: finalTitle,
            content: finalContent,
            tags: finalTags,
          });
          setSelectedFolderId(data.note.folder_path_id);
          initialFolderIdRef.current = data.note.folder_path_id;
          setSyncStatus(useLocal ? "idle" : "synced");

          // CRITICAL: Always save to IndexedDB when using server content
          // Use saveSyncedNote to set both updatedAt and syncedAt to server timestamp
          // This prevents false "local changes" detection on subsequent loads
          if (!useLocal) {
            await saveSyncedNote({
              id: data.note.id,
              title: finalTitle,
              content: finalContent,
              tags: finalTags,
              folderPathId: data.note.folder_path_id,
            }, serverUpdatedAt);
            console.log('[SYNC] Saved server content to IndexedDB with syncedAt:', serverUpdatedAt);
          }

          if (useLocal && localNote) {
            hasUnsyncedChanges.current = true;
            toast.info("ローカルの変更を復元しました");
          }
        }
      } else {
        // Note not found (may have been deleted)
        localStorage.removeItem('lastOpenedNoteId');
        toast.warning("ノートが見つかりませんでした。新規作成します。");
        await createNewDraft();
      }
    } catch (error) {
      console.error("Failed to load note:", error);
      // Clear localStorage and create new draft on error
      localStorage.removeItem('lastOpenedNoteId');
      toast.error("ノートの読み込みに失敗しました");
      await createNewDraft();
    } finally {
      setLoading(false);
      isLoadingNote.current = false;
    }
  };

  // Save to IndexedDB with 1 second debounce
  const saveToLocal = useCallback(async () => {
    if (!note.id) return;

    try {
      // Don't pass syncedAt - let saveLocalNote preserve existing value
      await saveLocalNote({
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        folderPathId: selectedFolderId,
      });
    } catch (error) {
      console.error("Failed to save to IndexedDB:", error);
    }
  }, [note, selectedFolderId]);

  // Save to Supabase with 3 second debounce (with optimistic locking)
  const saveToCloud = useCallback(async () => {
    if (!note.id || !isOnline) return;

    try {
      // Get current syncedAt for optimistic locking
      const localNote = await getLocalNote(note.id);
      const expectedUpdatedAt = localNote?.syncedAt || 0;

      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          tags: note.tags,
          saveToDbOnly: true,
          expected_updated_at: expectedUpdatedAt > 0 ? expectedUpdatedAt : undefined,
        }),
      });

      if (response.status === 409) {
        // Conflict detected - another device updated the note
        console.log('[SYNC] Optimistic lock conflict on saveToCloud');
        const data = await response.json();
        if (data.serverNote) {
          setRemoteContent(data.serverNote.content || '');
          setSyncStatus("conflict");
          setShowConflictModal(true);
        }
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setLastSaved(new Date());
        // Use server's updated_at to track which version we've synced to
        const serverUpdatedAt = new Date(data.note?.updated_at || Date.now()).getTime();
        await markNoteSynced(note.id, serverUpdatedAt);

        // Notify other tabs of the save
        broadcastChannelRef.current?.postMessage({
          type: 'NOTE_SAVED',
          noteId: note.id,
          tabId: tabIdRef.current,
          content: note.content,
        });
      }
    } catch (error) {
      console.error("Failed to save to cloud:", error);
    }
  }, [note, isOnline]);

  // Local save effect (1 second debounce)
  useEffect(() => {
    if (localSaveTimerRef.current) {
      clearTimeout(localSaveTimerRef.current);
    }

    if (note.id && (note.title || note.content)) {
      localSaveTimerRef.current = setTimeout(saveToLocal, LOCAL_SAVE_DELAY);
    }

    return () => {
      if (localSaveTimerRef.current) {
        clearTimeout(localSaveTimerRef.current);
      }
    };
  }, [note, saveToLocal]);

  // Cloud save effect (3 second debounce)
  useEffect(() => {
    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }

    if (note.id && (note.title || note.content) && isOnline) {
      cloudSaveTimerRef.current = setTimeout(saveToCloud, CLOUD_SAVE_DELAY);
    }

    return () => {
      if (cloudSaveTimerRef.current) {
        clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, [note, saveToCloud, isOnline]);

  // Sync to Git function
  const syncToGit = useCallback(async () => {
    if (!note.id || !note.title) {
      if (!note.title) {
        toast.error("タイトルを入力してください");
      }
      return;
    }

    if (!isOnline) {
      toast.error("オフラインのため同期できません");
      return;
    }

    setSyncing(true);
    setSyncStatus("syncing");
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...note,
          folder_path_id: selectedFolderId,
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        setSyncStatus("conflict");
        setRemoteContent(data.remoteContent || "");
        setShowConflictModal(true);
        toast.error("コンフリクトが検出されました");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to sync");
      }

      const data = await response.json();
      hasUnsyncedChanges.current = false;
      setSyncStatus("synced");
      // Use server's updated_at to track which version we've synced to
      const serverUpdatedAt = new Date(data.note?.updated_at || Date.now()).getTime();
      await markNoteSynced(note.id, serverUpdatedAt);
      toast.success("同期しました");
    } catch (error) {
      console.error("Error syncing to Git:", error);
      setSyncStatus("error");
      toast.error("同期に失敗しました");
    } finally {
      setSyncing(false);
    }
  }, [note, selectedFolderId, isOnline]);

  // 30-second auto-save timer for Git sync
  useEffect(() => {
    if (!hasUnsyncedChanges.current || !note.id || (!note.title && !note.content) || !isOnline) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (note.title) {
        syncToGit();
      }
    }, AUTOSAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [note.content, note.title, note.tags, note.id, syncToGit, isOnline]);

  // Handle folder change - move file on GitHub
  const handleFolderChange = async (newFolderId: string) => {
    if (!note.id || newFolderId === selectedFolderId) return;

    const targetFolder = folders.find(f => f.id === newFolderId);
    if (!targetFolder) return;

    setIsMovingFolder(true);
    toast.loading(`${getFolderDisplayName(targetFolder)} に移動中...`, { id: 'folder-move' });

    try {
      const response = await fetch(`/api/notes/${note.id}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path_id: newFolderId }),
      });

      if (!response.ok) {
        throw new Error('Failed to move note');
      }

      setSelectedFolderId(newFolderId);
      toast.success(`${getFolderDisplayName(targetFolder)} に移動しました`, { id: 'folder-move' });
    } catch (error) {
      console.error('Failed to move note:', error);
      toast.error('フォルダの移動に失敗しました', { id: 'folder-move' });
    } finally {
      setIsMovingFolder(false);
    }
  };

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
      toast.success("上書きしました");
    } catch (error) {
      console.error("Error force overwriting:", error);
      setSyncStatus("error");
      toast.error("上書きに失敗しました");
    }
  };

  const handleUseRemote = async () => {
    if (!note.id) return;

    // Set flag to prevent conflict re-detection during resolution
    isResolvingConflict.current = true;

    try {
      // Close modal FIRST to prevent re-triggering by visibility changes
      setShowConflictModal(false);

      // Fetch fresh data from server
      const response = await fetch(`/api/notes/${note.id}`);
      const data = await response.json();

      if (data.note) {
        const serverContent = data.content || data.note.content || "";
        const serverUpdatedAt = new Date(data.note.updated_at || 0).getTime();

        // Update IndexedDB FIRST with server content to prevent conflict re-detection
        // This ensures handleVisibilityChange sees matching content
        await saveSyncedNote({
          id: note.id,
          title: data.note.title,
          content: serverContent,
          tags: data.note.tags || [],
          folderPathId: data.note.folder_path_id,
        }, serverUpdatedAt);

        // Then update React state
        setNote({
          id: data.note.id,
          title: data.note.title,
          content: serverContent,
          tags: data.note.tags || [],
        });

        hasUnsyncedChanges.current = false;
        setSyncStatus("synced");
        toast.success("リモート版に戻しました");
      }
    } catch (error) {
      console.error('Failed to use remote version:', error);
      toast.error("リモート版の取得に失敗しました");
      // Re-show modal on error so user can retry
      setShowConflictModal(true);
    } finally {
      // Clear the flag after a short delay to ensure state updates are processed
      setTimeout(() => {
        isResolvingConflict.current = false;
      }, 500);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-paper">
      {/* Minimal Header */}
      <header className="sticky top-0 z-20 px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          {/* Back button */}
          <button
            onClick={async () => {
              // Save immediately before navigation - MUST complete before navigating
              if (note.id && (note.title || note.content)) {
                console.log('[SYNC] Library navigation: Starting save...');
                try {
                  if (isOnline) {
                    // Save to cloud FIRST (this is the critical path for multi-device sync)
                    console.log('[SYNC] Library navigation: Saving to cloud...');
                    const response = await fetch(`/api/notes/${note.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: note.title,
                        content: note.content,
                        tags: note.tags,
                        saveToDbOnly: true,
                      }),
                    });

                    if (response.ok) {
                      const data = await response.json();
                      const serverUpdatedAt = new Date(data.note?.updated_at || Date.now()).getTime();
                      console.log('[SYNC] Library navigation: Cloud save success, serverUpdatedAt:', serverUpdatedAt);
                      // Update local cache with synced state
                      await saveSyncedNote({
                        id: note.id,
                        title: note.title,
                        content: note.content,
                        tags: note.tags,
                        folderPathId: selectedFolderId,
                      }, serverUpdatedAt);
                      hasUnsyncedChanges.current = false;
                    } else {
                      console.error('[SYNC] Library navigation: Cloud save failed, status:', response.status);
                      // Fallback: save to local only
                      await saveLocalNote({
                        id: note.id,
                        title: note.title,
                        content: note.content,
                        tags: note.tags,
                        folderPathId: selectedFolderId,
                      });
                    }
                  } else {
                    // Offline: save to local only
                    console.log('[SYNC] Library navigation: Offline, saving to local only');
                    await saveLocalNote({
                      id: note.id,
                      title: note.title,
                      content: note.content,
                      tags: note.tags,
                      folderPathId: selectedFolderId,
                    });
                  }
                } catch (error) {
                  console.error('[SYNC] Library navigation: Save failed:', error);
                  // Last resort: try local save
                  try {
                    await saveLocalNote({
                      id: note.id,
                      title: note.title,
                      content: note.content,
                      tags: note.tags,
                      folderPathId: selectedFolderId,
                    });
                  } catch (localError) {
                    console.error('[SYNC] Library navigation: Local save also failed:', localError);
                  }
                }
              }
              console.log('[SYNC] Library navigation: Save complete, navigating...');
              router.push("/library");
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span className="text-sm font-medium">Library</span>
          </button>

          {/* Center: Sync status */}
          <div className="flex items-center gap-3">
            <SyncStatusDisplay status={syncStatus} lastSaved={lastSaved} />
            <span className="text-[10px] text-muted-foreground/50">v0.2.1</span>
            {!isOnline && (
              <span className="text-xs text-warning font-medium px-2 py-0.5 bg-warning/10 rounded-full">オフライン</span>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              title="キーボードショートカット (?)"
            >
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
            </button>
            <button
              onClick={syncToGit}
              disabled={syncing || !isOnline}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              {syncing ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 md:px-6 py-8 pb-32 animate-fade-in">
        {/* Labels section with Add Tag button outside scroll container */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {/* Add Tag button with dropdown - OUTSIDE scroll container */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowTagSelector(!showTagSelector)}
                className="flex h-8 items-center justify-center gap-x-1 rounded-full bg-muted hover:bg-muted/80 pl-2.5 pr-3 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-muted-foreground text-[18px]">
                  {showTagSelector ? "close" : "add"}
                </span>
                <span className="text-muted-foreground text-sm font-medium">Tag</span>
              </button>
              {/* Tag selector dropdown - positioned correctly */}
              {showTagSelector && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTagSelector(false)} />
                  <div className="absolute left-0 top-full mt-2 bg-card border border-border rounded-2xl shadow-lg p-2 min-w-[220px] z-50 max-h-[300px] overflow-y-auto animate-slide-up">
                    {labels.filter(l => !note.tags.includes(l.tag_name)).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        全てのラベルが選択済みです
                      </div>
                    ) : (
                      labels.filter(l => !note.tags.includes(l.tag_name)).map((label) => (
                        <button
                          key={label.id}
                          onClick={() => {
                            toggleLabel(label.id);
                            setShowTagSelector(false);
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
                        >
                          <span
                            className="w-3 h-3 rounded-full ring-2 ring-white/50"
                            style={{ backgroundColor: label.color }}
                          />
                          <span className="text-sm font-medium">{label.tag_name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Scrollable selected labels */}
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-2 w-max">
                {labels.filter(l => note.tags.includes(l.tag_name)).map((label) => (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className="group flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full pl-3 pr-2.5 transition-all active:scale-95 hover:shadow-md"
                    style={{
                      backgroundColor: `${label.color}15`,
                      border: `1.5px solid ${label.color}40`
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm font-medium" style={{ color: label.color }}>
                      {label.tag_name}
                    </span>
                    <span
                      className="material-symbols-outlined text-[14px] opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ color: label.color }}
                    >
                      close
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Folder Selection - compact inline style */}
        {folders.length > 0 && (
          <div className="mb-8 flex items-center gap-2">
            <span className="material-symbols-outlined text-muted-foreground text-[18px]">folder</span>
            <select
              value={selectedFolderId || ""}
              onChange={(e) => handleFolderChange(e.target.value)}
              disabled={isMovingFolder}
              className="rounded-lg border-none bg-transparent text-sm text-muted-foreground outline-none cursor-pointer hover:text-foreground transition-colors disabled:opacity-50"
            >
              {folders.map((folder) => (
                <option key={folder.id || folder.path} value={folder.id || ""}>
                  {getFolderDisplayName(folder)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Editor Card - clean minimal design */}
        <div className="rounded-2xl bg-card p-6 md:p-8 shadow-sm border border-border/50 animate-slide-up">
          {/* Title input with display font */}
          <input
            type="text"
            value={note.title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className="mb-6 w-full border-none pb-3 text-3xl md:text-4xl font-bold leading-tight tracking-tight outline-none bg-transparent placeholder:text-muted-foreground/40 placeholder:italic"
            style={{ fontFamily: 'var(--font-display)' }}
          />

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-6" />

          {/* Editor */}
          <Editor
            content={note.content}
            onChange={handleContentChange}
            placeholder="Start writing..."
          />
        </div>
      </main>

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border animate-slide-up">
            <div className="mb-4 flex items-center gap-3 text-error">
              <div className="flex size-10 items-center justify-center rounded-full bg-error/10">
                <span className="material-symbols-outlined text-error">warning</span>
              </div>
              <h2 className="text-lg font-semibold">コンフリクトが検出されました</h2>
            </div>
            <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
              このノートは最後の同期以降にGitHub上で変更されています。どちらのバージョンを使用しますか？
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleForceOverwrite}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 active:scale-[0.98] transition-all"
              >
                自分のバージョンを使用（リモートを上書き）
              </button>
              <button
                onClick={handleUseRemote}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted active:scale-[0.98] transition-all"
              >
                リモートバージョンを使用（自分の変更を破棄）
              </button>
              <button
                onClick={() => setShowConflictModal(false)}
                className="w-full rounded-xl px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
