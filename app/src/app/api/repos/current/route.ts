import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
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

    // Get repo connection
    const { data: repoConnection, error: repoError } = await supabase
      .from('repo_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (repoError || !repoConnection) {
      return NextResponse.json({ connected: false, repoConnection: null });
    }

    return NextResponse.json({
      connected: true,
      repoConnection: {
        provider: repoConnection.provider,
        repoFullName: repoConnection.repo_full_name,
        defaultBranch: repoConnection.default_branch,
        basePath: repoConnection.base_path,
      }
    });
  } catch (error) {
    console.error('Error fetching repo connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
