import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // Get installation_id from environment
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

    if (!installationId) {
      return NextResponse.json({ error: 'GitHub App not configured' }, { status: 500 });
    }

    // Verify access to the repository
    const octokit = getOctokitForInstallation(Number(installationId));
    const [owner, repo] = repoFullName.split('/');

    try {
      await octokit.repos.get({ owner, repo });
    } catch (error) {
      return NextResponse.json({ error: 'Cannot access repository. Make sure the GitHub App has access.' }, { status: 403 });
    }

    // Upsert repo connection
    const { error: upsertError } = await supabase
      .from('repo_connections')
      .upsert({
        user_id: user.id,
        provider: 'github',
        repo_full_name: repoFullName,
        default_branch: defaultBranch || 'main',
        base_path: basePath || '',
        github_installation_id: parseInt(installationId),
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
