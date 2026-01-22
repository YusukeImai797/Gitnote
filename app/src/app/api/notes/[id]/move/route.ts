import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForUser } from '@/lib/github';

// PUT /api/notes/:id/move - Move a note to a different folder
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session.accessToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = session.accessToken as string;

    try {
        const { id } = await params;
        const body = await request.json();
        const { folder_path_id } = body;

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

        // Get note
        const { data: note, error: noteError } = await supabase
            .from('notes')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (noteError || !note) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
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

        // Get target folder path
        const { data: targetFolder, error: folderError } = await supabase
            .from('folder_paths')
            .select('path')
            .eq('id', folder_path_id)
            .eq('repo_connection_id', repoConnection.id)
            .single();

        if (folderError || !targetFolder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        // If note has no path yet (new draft), just update the folder_path_id
        if (!note.path) {
            const { data: updatedNote, error: updateError } = await supabase
                .from('notes')
                .update({ folder_path_id })
                .eq('id', id)
                .select()
                .single();

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
            }

            return NextResponse.json({ note: updatedNote, moved: true });
        }

        // Move file on GitHub (delete old, create new)
        const octokit = getOctokitForUser(accessToken);
        const [owner, repo] = repoConnection.repo_full_name.split('/');

        // Get current file content
        const { data: currentFile } = await octokit.repos.getContent({
            owner,
            repo,
            path: note.path,
            ref: repoConnection.default_branch,
        });

        if (!('content' in currentFile)) {
            return NextResponse.json({ error: 'Failed to get current file' }, { status: 500 });
        }

        // Calculate new path
        const filename = note.path.split('/').pop();
        const newPath = `${targetFolder.path}${filename}`;

        // Check if already in target folder (same path)
        if (newPath === note.path) {
            // Already in target folder, just update folder_path_id in DB if needed
            const { data: updatedNote, error: updateError } = await supabase
                .from('notes')
                .update({ folder_path_id })
                .eq('id', id)
                .select()
                .single();

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
            }

            return NextResponse.json({ note: updatedNote, moved: false, message: 'Already in target folder' });
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

        // Delete file from old location
        await octokit.repos.deleteFile({
            owner,
            repo,
            path: note.path,
            message: `Move note: ${note.title} (delete from old location)`,
            sha: currentFile.sha,
            branch: repoConnection.default_branch,
        });

        // Update note in database
        const { data: updatedNote, error: updateError } = await supabase
            .from('notes')
            .update({
                path: newPath,
                folder_path_id,
                last_commit_sha: newFile.commit.sha,
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating note after move:', updateError);
            return NextResponse.json({ error: 'Failed to update note metadata' }, { status: 500 });
        }

        return NextResponse.json({ note: updatedNote, moved: true });
    } catch (error) {
        console.error('Error in PUT /api/notes/:id/move:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
