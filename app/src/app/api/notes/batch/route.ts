import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

// DELETE /api/notes/batch - Delete multiple notes
export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { note_ids } = body;

        if (!note_ids || !Array.isArray(note_ids) || note_ids.length === 0) {
            return NextResponse.json({ error: 'note_ids array is required' }, { status: 400 });
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

        // Get repo connection
        const { data: repoConnection } = await supabase
            .from('repo_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

        if (!repoConnection) {
            return NextResponse.json({ error: 'No active repository connection' }, { status: 400 });
        }

        // Get all notes to be deleted
        const { data: notes, error: notesError } = await supabase
            .from('notes')
            .select('*')
            .in('id', note_ids)
            .eq('user_id', user.id);

        if (notesError || !notes) {
            return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
        }

        const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
        const [owner, repo] = repoConnection.repo_full_name.split('/');

        const results = {
            deleted: [] as string[],
            failed: [] as { id: string; error: string }[],
        };

        // Delete each note from GitHub and DB
        for (const note of notes) {
            try {
                // Delete from GitHub if path exists
                if (note.path) {
                    try {
                        const { data: fileData } = await octokit.repos.getContent({
                            owner,
                            repo,
                            path: note.path,
                            ref: repoConnection.default_branch,
                        });

                        if ('sha' in fileData) {
                            await octokit.repos.deleteFile({
                                owner,
                                repo,
                                path: note.path,
                                message: `Delete note: ${note.title}`,
                                sha: fileData.sha,
                                branch: repoConnection.default_branch,
                            });
                        }
                    } catch (githubError: unknown) {
                        // File might not exist, continue with DB deletion
                        console.log(`GitHub file not found for note ${note.id}, continuing with DB deletion`);
                    }
                }

                // Delete from database
                const { error: deleteError } = await supabase
                    .from('notes')
                    .delete()
                    .eq('id', note.id);

                if (deleteError) {
                    results.failed.push({ id: note.id, error: deleteError.message });
                } else {
                    results.deleted.push(note.id);
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.failed.push({ id: note.id, error: errorMessage });
            }
        }

        return NextResponse.json({
            success: true,
            deleted: results.deleted,
            failed: results.failed,
            deletedCount: results.deleted.length,
            failedCount: results.failed.length,
        });
    } catch (error) {
        console.error('Error in DELETE /api/notes/batch:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
