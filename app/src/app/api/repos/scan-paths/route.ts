import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForUser } from '@/lib/github';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = session.accessToken as string;

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

    // Get repository tree
    const octokit = getOctokitForUser(accessToken);
    const [owner, repo] = repoConnection.repo_full_name.split('/');

    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: repoConnection.default_branch,
      recursive: 'true',
    });

    // Find all directories that contain "notes" or "note" in their path
    const notePaths = new Set<string>();

    for (const item of tree.tree) {
      if (item.type === 'tree' && item.path) {
        const path = item.path;

        // Check if this is a notes folder or contains one
        if (path.includes('notes') || path.includes('note') || path.includes('Notes')) {
          // Add the folder and parent folders
          notePaths.add(path + '/');

          // Also add parent if it exists
          const parts = path.split('/');
          if (parts.length > 1) {
            const parent = parts.slice(0, -1).join('/');
            notePaths.add(parent + '/notes/');
          }
        }
      }
    }

    // Also find common project folders (folders at root level)
    const rootFolders = new Set<string>();
    for (const item of tree.tree) {
      if (item.type === 'tree' && item.path && !item.path.includes('/')) {
        rootFolders.add(item.path + '/notes/');
      }
    }

    // Combine and sort paths
    const allPaths = Array.from(new Set([...notePaths, ...rootFolders])).sort();

    return NextResponse.json({ paths: allPaths });
  } catch (error) {
    console.error('Error scanning repository:', error);
    return NextResponse.json({ error: 'Failed to scan repository' }, { status: 500 });
  }
}
