import Dexie, { type Table } from 'dexie';

export interface LocalNote {
    id: string;           // Supabase note_id
    title: string;
    content: string;
    tags: string[];
    folderPathId: string | null;
    updatedAt: number;    // Local update timestamp
    syncedAt: number;     // Supabase sync timestamp
}

class GitnoteDB extends Dexie {
    notes!: Table<LocalNote>;

    constructor() {
        super('gitnote');
        this.version(1).stores({
            notes: 'id, updatedAt, syncedAt'
        });
    }
}

export const db = new GitnoteDB();

// Save note to IndexedDB (preserves existing syncedAt unless explicitly provided)
export async function saveLocalNote(note: Partial<LocalNote> & { id: string }): Promise<void> {
    const existing = await db.notes.get(note.id);
    await db.notes.put({
        // Preserve existing syncedAt if not explicitly provided
        syncedAt: existing?.syncedAt ?? 0,
        ...note,
        updatedAt: Date.now(),
    } as LocalNote);
}

// Get note from IndexedDB
export async function getLocalNote(id: string): Promise<LocalNote | undefined> {
    return db.notes.get(id);
}

// Get all unsyced notes (updatedAt > syncedAt)
export async function getUnsyncedNotes(): Promise<LocalNote[]> {
    return db.notes.filter(note => note.updatedAt > note.syncedAt).toArray();
}

// Mark note as synced with the server's updated_at timestamp
// serverUpdatedAt is required to properly track which version we've synced to
export async function markNoteSynced(id: string, serverUpdatedAt: number): Promise<void> {
    await db.notes.update(id, { syncedAt: serverUpdatedAt });
}

// Save synced note from server - both updatedAt and syncedAt set to server timestamp
// Use this when caching server content to avoid false "local changes" detection
export async function saveSyncedNote(note: Omit<LocalNote, 'updatedAt' | 'syncedAt'>, serverUpdatedAt: number): Promise<void> {
    await db.notes.put({
        ...note,
        updatedAt: serverUpdatedAt,
        syncedAt: serverUpdatedAt,
    } as LocalNote);
}

// Delete note from IndexedDB
export async function deleteLocalNote(id: string): Promise<void> {
    await db.notes.delete(id);
}

// Get the most recently updated note
export async function getMostRecentNote(): Promise<LocalNote | undefined> {
    return db.notes.orderBy('updatedAt').reverse().first();
}
