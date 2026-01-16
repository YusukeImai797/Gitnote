import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { defaultPath } = body;

    if (!defaultPath) {
      return NextResponse.json({ error: 'Default path is required' }, { status: 400 });
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
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (repoError || !repoConnection) {
      return NextResponse.json({ error: 'No active repository connection' }, { status: 404 });
    }

    // Create or update default label mapping
    const { error: upsertError } = await supabase
      .from('tag_mappings')
      .upsert({
        user_id: user.id,
        repo_connection_id: repoConnection.id,
        tag_name: '_unlabeled',
        target_path: defaultPath,
        color: '#6B7280', // Gray color for unlabeled
        description: 'Default location for notes without labels',
        is_default: true,
        github_synced: false, // Not a GitHub label
        sync_status: 'synced',
        deleted_at: null,
      }, {
        onConflict: 'repo_connection_id,tag_name',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Error creating default label:', upsertError);
      return NextResponse.json({ error: 'Failed to create default label' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting default path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
