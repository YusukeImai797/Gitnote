import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';

// PUT /api/notes/batch/labels - Add or remove labels from multiple notes
export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { note_ids, add_labels = [], remove_labels = [] } = body;

        if (!note_ids || !Array.isArray(note_ids) || note_ids.length === 0) {
            return NextResponse.json({ error: 'note_ids array is required' }, { status: 400 });
        }

        if (add_labels.length === 0 && remove_labels.length === 0) {
            return NextResponse.json({ error: 'Either add_labels or remove_labels is required' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get all notes to be updated
        const { data: notes, error: notesError } = await supabase
            .from('notes')
            .select('id, tags')
            .in('id', note_ids)
            .eq('user_id', user.id);

        if (notesError || !notes) {
            return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
        }

        const results = {
            updated: [] as string[],
            failed: [] as { id: string; error: string }[],
        };

        for (const note of notes) {
            try {
                let newTags = [...(note.tags || [])];

                // Remove labels
                if (remove_labels.length > 0) {
                    newTags = newTags.filter(tag => !remove_labels.includes(tag));
                }

                // Add labels
                if (add_labels.length > 0) {
                    for (const label of add_labels) {
                        if (!newTags.includes(label)) {
                            newTags.push(label);
                        }
                    }
                }

                // Update in database
                const { error: updateError } = await supabase
                    .from('notes')
                    .update({ tags: newTags })
                    .eq('id', note.id);

                if (updateError) {
                    results.failed.push({ id: note.id, error: updateError.message });
                } else {
                    results.updated.push(note.id);
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.failed.push({ id: note.id, error: errorMessage });
            }
        }

        return NextResponse.json({
            success: true,
            updated: results.updated,
            failed: results.failed,
            updatedCount: results.updated.length,
            failedCount: results.failed.length,
        });
    } catch (error) {
        console.error('Error in PUT /api/notes/batch/labels:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
