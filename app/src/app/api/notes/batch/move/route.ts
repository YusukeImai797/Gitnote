import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForUser } from '@/lib/github';

// PUT /api/notes/batch/move - Move multiple notes to a folder
export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = session.accessToken as string;

    try {
        const body = await request.json();
        const { note_ids, folder_path_id } = body;

        if (!note_ids || !Array.isArray(note_ids) || note_ids.length === 0) {
            return NextResponse.json({ error: 'note_ids array is required' }, { status: 400 });
        }

        if (!folder_path_id) {
            return NextResponse.json({ error: 'folder_path_id is required' }, { status: 400 });
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

        // Get target folder
        const { data: targetFolder, error: folderError } = await supabase
            .from('folder_paths')
            .select('path')
            .eq('id', folder_path_id)
            .eq('repo_connection_id', repoConnection.id)
            .single();

        if (folderError || !targetFolder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        // Get all notes to be moved
        const { data: notes, error: notesError } = await supabase
            .from('notes')
            .select('*')
            .in('id', note_ids)
            .eq('user_id', user.id);

        if (notesError || !notes) {
            return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
        }

        const octokit = getOctokitForUser(accessToken);
        const [owner, repo] = repoConnection.repo_full_name.split('/');

        const results = {
            moved: [] as string[],
            skipped: [] as string[],
            failed: [] as { id: string; error: string }[],
        };

        for (const note of notes) {
            try {
                if (!note.path) {
                    // Just update folder_path_id in DB
                    await supabase
                        .from('notes')
                        .update({ folder_path_id })
                        .eq('id', note.id);
                    results.moved.push(note.id);
                    continue;
                }

                const filename = note.path.split('/').pop();
                const newPath = `${targetFolder.path}${filename}`;

                // Skip if already in target folder
                if (newPath === note.path) {
                    results.skipped.push(note.id);
                    continue;
                }

                // Get current file content
                const { data: currentFile } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: note.path,
                    ref: repoConnection.default_branch,
                });

                if (!('content' in currentFile)) {
                    results.failed.push({ id: note.id, error: 'Failed to get file content' });
                    continue;
                }

                // Create file in new location
                const { data: newFile } = await octokit.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path: newPath,
                    message: `Move note: ${note.title} to ${targetFolder.path}`,
                    content: currentFile.content,
                    branch: repoConnection.default_branch,
                });

                // Delete from old location
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: note.path,
                    message: `Move note: ${note.title} (delete from old location)`,
                    sha: currentFile.sha,
                    branch: repoConnection.default_branch,
                });

                // Update database
                await supabase
                    .from('notes')
                    .update({
                        path: newPath,
                        folder_path_id,
                        last_commit_sha: newFile.commit.sha,
                    })
                    .eq('id', note.id);

                results.moved.push(note.id);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.failed.push({ id: note.id, error: errorMessage });
            }
        }

        return NextResponse.json({
            success: true,
            moved: results.moved,
            skipped: results.skipped,
            failed: results.failed,
            movedCount: results.moved.length,
            skippedCount: results.skipped.length,
            failedCount: results.failed.length,
        });
    } catch (error) {
        console.error('Error in PUT /api/notes/batch/move:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
