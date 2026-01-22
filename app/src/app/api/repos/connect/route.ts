import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForUser } from '@/lib/github';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized - missing access token' }, { status: 401 });
  }

  const accessToken = session.accessToken as string;

  try {
    const body = await request.json();
    const { repoFullName, defaultBranch, basePath } = body;

    if (!repoFullName) {
      return NextResponse.json({ error: 'Repository name is required' }, { status: 400 });
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

    // Verify access to the repository using user's OAuth token
    const octokit = getOctokitForUser(accessToken);
    const [owner, repo] = repoFullName.split('/');

    try {
      await octokit.repos.get({ owner, repo });
    } catch (error: any) {
      if (error.status === 401) {
        return NextResponse.json({ error: 'GitHub token expired. Please sign in again.' }, { status: 401 });
      }
      if (error.status === 404) {
        return NextResponse.json({ error: 'Repository not found or you do not have access.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Cannot access repository.' }, { status: 403 });
    }

    // Upsert repo connection (no longer need github_installation_id)
    const { error: upsertError } = await supabase
      .from('repo_connections')
      .upsert({
        user_id: user.id,
        provider: 'github',
        repo_full_name: repoFullName,
        default_branch: defaultBranch || 'main',
        base_path: basePath || '',
        status: 'active',
      }, {
        onConflict: 'user_id,repo_full_name'
      });

    if (upsertError) {
      console.error('Error upserting repo connection:', upsertError);
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error connecting repo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
