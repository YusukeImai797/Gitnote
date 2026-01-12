import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';

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
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (repoError || !repoConnection) {
      return NextResponse.json({ error: 'No active repository connection' }, { status: 404 });
    }

    // Get tag mappings
    const { data: labels, error: labelsError } = await supabase
      .from('tag_mappings')
      .select('*')
      .eq('repo_connection_id', repoConnection.id)
      .is('deleted_at', null)
      .order('tag_name');

    if (labelsError) {
      console.error('Error fetching labels:', labelsError);
      return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
    }

    return NextResponse.json({ labels: labels || [] });
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
