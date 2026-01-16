import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

const DEFAULT_TITLE = 'Untitled Note';

// POST /api/notes/create-draft - Create a new draft note with ID (actually creates file on GitHub)
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { folder_path_id } = body;

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
        const { data: repoConnection, error: repoError } = await supabase
            .from('repo_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

        if (repoError || !repoConnection) {
            return NextResponse.json({ error: 'No active repository connection' }, { status: 400 });
        }

        // Determine folder path
        let folderPathId = folder_path_id || null;
        let targetPath = 'notes/';

        if (folder_path_id) {
            const { data: folder } = await supabase
                .from('folder_paths')
                .select('path')
                .eq('id', folder_path_id)
                .eq('repo_connection_id', repoConnection.id)
                .single();

            if (folder) {
                targetPath = folder.path;
            }
        } else {
            // Get default folder
            const { data: defaultFolder } = await supabase
                .from('folder_paths')
                .select('id, path')
                .eq('repo_connection_id', repoConnection.id)
                .eq('is_default', true)
                .single();

            if (defaultFolder) {
                folderPathId = defaultFolder.id;
                targetPath = defaultFolder.path;
            }
        }

        // Generate filename from default title
        const timestamp = Date.now();
        const filename = `untitled-note-${timestamp}`;
        const filePath = `${targetPath}${filename}.md`;

        // Create markdown with front matter
        const now = new Date().toISOString();
        const frontMatter = [
            '---',
            `title: "${DEFAULT_TITLE}"`,
            `tags: []`,
            `created_at: "${now}"`,
            `updated_at: "${now}"`,
            '---',
            '',
        ].join('\n');

        const fullContent = frontMatter + '\n';

        // Create file on GitHub
        const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
        const [owner, repo] = repoConnection.repo_full_name.split('/');

        const { data: fileData } = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: `Create note: ${DEFAULT_TITLE}`,
            content: Buffer.from(fullContent).toString('base64'),
            branch: repoConnection.default_branch,
        });

        // Save note to database
        const { data: note, error: noteError } = await supabase
            .from('notes')
            .insert({
                user_id: user.id,
                repo_connection_id: repoConnection.id,
                folder_path_id: folderPathId,
                title: DEFAULT_TITLE,
                path: filePath,
                tags: [],
                word_count: 0,
                last_commit_sha: fileData.commit.sha,
                status: 'synced',
            })
            .select()
            .single();

        if (noteError) {
            console.error('Error creating draft note:', noteError);
            return NextResponse.json({ error: 'Failed to create draft', details: noteError.message }, { status: 500 });
        }

        return NextResponse.json({ note, folder_path_id: folderPathId });
    } catch (error) {
        console.error('Error in POST /api/notes/create-draft:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
