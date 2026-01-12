import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

// GET /api/folders - List all folder paths with aliases
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
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

        // Get active repo connection
        const { data: repoConnection, error: repoError } = await supabase
            .from('repo_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

        if (repoError || !repoConnection) {
            return NextResponse.json({ error: 'No active repository connection' }, { status: 404 });
        }

        // Get folder paths (handle case where table doesn't exist yet)
        let folders = null;
        let foldersError = null;

        try {
            const result = await supabase
                .from('folder_paths')
                .select('*')
                .eq('repo_connection_id', repoConnection.id)
                .order('path');
            folders = result.data;
            foldersError = result.error;
        } catch (err) {
            // Table might not exist
            foldersError = err;
        }

        // If table doesn't exist or no folders, scan repository
        if (foldersError || !folders || folders.length === 0) {
            const scannedPaths = await scanRepositoryPaths(repoConnection);
            return NextResponse.json({
                folders: scannedPaths.map(path => ({
                    id: null,
                    path,
                    alias: null,
                    is_default: path === 'notes/',
                })),
                isScanned: true
            });
        }

        return NextResponse.json({ folders, isScanned: false });
    } catch (error) {
        console.error('Error in GET /api/folders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/folders - Create or update folder paths with aliases
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { folders } = body;

        if (!Array.isArray(folders)) {
            return NextResponse.json({ error: 'folders must be an array' }, { status: 400 });
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

        // Get active repo connection
        const { data: repoConnection, error: repoError } = await supabase
            .from('repo_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

        if (repoError || !repoConnection) {
            return NextResponse.json({ error: 'No active repository connection' }, { status: 404 });
        }

        // Upsert folder paths
        const upsertData = folders.map((folder: { path: string; alias?: string; is_default?: boolean }) => ({
            user_id: user.id,
            repo_connection_id: repoConnection.id,
            path: folder.path,
            alias: folder.alias || null,
            is_default: folder.is_default || false,
        }));

        // Reset all is_default to false first if any is_default is true
        const hasDefault = upsertData.some((f: { is_default: boolean }) => f.is_default);
        if (hasDefault) {
            await supabase
                .from('folder_paths')
                .update({ is_default: false })
                .eq('repo_connection_id', repoConnection.id);
        }

        const { data: savedFolders, error: saveError } = await supabase
            .from('folder_paths')
            .upsert(upsertData, { onConflict: 'repo_connection_id,path' })
            .select();

        if (saveError) {
            console.error('Error saving folders:', saveError);
            return NextResponse.json({ error: 'Failed to save folders' }, { status: 500 });
        }

        return NextResponse.json({ folders: savedFolders });
    } catch (error) {
        console.error('Error in POST /api/folders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Helper function to scan repository for paths
async function scanRepositoryPaths(repoConnection: { github_installation_id: number; repo_full_name: string; default_branch: string }): Promise<string[]> {
    try {
        const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
        const [owner, repo] = repoConnection.repo_full_name.split('/');

        const { data: tree } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: repoConnection.default_branch,
            recursive: 'true',
        });

        const paths = new Set<string>();
        paths.add('notes/'); // Always include default

        for (const item of tree.tree) {
            if (item.type === 'tree' && item.path) {
                // Add folders that might be for notes
                if (item.path.includes('notes') || item.path.includes('Notes')) {
                    paths.add(item.path + '/');
                }
                // Add top-level folders with /notes/ suffix
                if (!item.path.includes('/')) {
                    paths.add(item.path + '/notes/');
                }
            }
        }

        return Array.from(paths).sort();
    } catch (error) {
        console.error('Error scanning repository:', error);
        return ['notes/'];
    }
}
