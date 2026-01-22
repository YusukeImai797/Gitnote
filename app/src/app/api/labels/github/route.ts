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

    // Get labels from GitHub
    const octokit = getOctokitForUser(accessToken);
    const [owner, repo] = repoConnection.repo_full_name.split('/');

    const { data: labels } = await octokit.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });

    return NextResponse.json({
      labels: labels.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description || '',
      }))
    });
  } catch (error) {
    console.error('Error fetching GitHub labels:', error);
    return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
  }
}
