import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

// PUT /api/notes/:id/force - Force overwrite a note (ignore conflict)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { title, content, tags = [] } = body;

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

        // Get current file SHA from GitHub (to force update)
        const octokit = getOctokitForInstallation(Number(repoConnection.github_installation_id));
        const [owner, repo] = repoConnection.repo_full_name.split('/');

        let currentSha: string;
        try {
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: note.path,
                ref: repoConnection.default_branch,
            });

            if ('sha' in fileData) {
                currentSha = fileData.sha;
            } else {
                throw new Error('Could not get file SHA');
            }
        } catch (error) {
            console.error('Error getting file SHA:', error);
            return NextResponse.json({ error: 'Failed to get current file state' }, { status: 500 });
        }

        // Update markdown with front matter
        const frontMatter = [
            '---',
            `title: "${title || note.title}"`,
            `tags: [${tags.map((t: string) => `"${t}"`).join(', ')}]`,
            `created_at: "${note.created_at}"`,
            `updated_at: "${new Date().toISOString()}"`,
            '---',
            '',
        ].join('\n');

        const fullContent = frontMatter + content;

        // Force update on GitHub with current SHA
        const { data: updateData } = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: note.path,
            message: `Force update note: ${title || note.title}`,
            content: Buffer.from(fullContent).toString('base64'),
            branch: repoConnection.default_branch,
            sha: currentSha,
        });

        // Update note metadata
        const { data: updatedNote, error: updateError } = await supabase
            .from('notes')
            .update({
                title: title || note.title,
                tags,
                word_count: content.split(/\s+/).length,
                last_commit_sha: updateData.commit.sha,
                status: 'synced',
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating note metadata:', updateError);
            return NextResponse.json({ error: 'Failed to update note metadata' }, { status: 500 });
        }

        return NextResponse.json({ note: updatedNote, status: 'synced' });
    } catch (error) {
        console.error('Error in PUT /api/notes/:id/force:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
