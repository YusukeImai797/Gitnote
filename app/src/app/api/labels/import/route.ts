import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { labelIds } = body;

    if (!Array.isArray(labelIds) || labelIds.length === 0) {
      return NextResponse.json({ error: 'No labels selected' }, { status: 400 });
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

    // Get GitHub labels
    const { getOctokitForInstallation } = await import('@/lib/github');
    const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
    const [owner, repo] = repoConnection.repo_full_name.split('/');

    const { data: allLabels } = await octokit.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });

    // Filter selected labels
    const selectedLabels = allLabels.filter(label => labelIds.includes(label.id));
    const selectedLabelNames = new Set(selectedLabels.map(l => l.name));

    // Get existing mappings for this repo
    const { data: existingMappings } = await supabase
      .from('tag_mappings')
      .select('id, tag_name, github_label_id')
      .eq('repo_connection_id', repoConnection.id);

    // Mark unselected labels as deleted
    const unselectedMappings = (existingMappings || []).filter(
      m => !selectedLabelNames.has(m.tag_name)
    );

    if (unselectedMappings.length > 0) {
      const { error: deleteError } = await supabase
        .from('tag_mappings')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', unselectedMappings.map(m => m.id));

      if (deleteError) {
        console.error('Error marking labels as deleted:', deleteError);
      }
    }

    // Insert or restore selected labels
    const tagMappings = selectedLabels.map(label => ({
      user_id: user.id,
      repo_connection_id: repoConnection.id,
      tag_name: label.name,
      target_path: `notes/${label.name}/`, // Default path
      color: `#${label.color}`,
      description: label.description || '',
      github_label_id: label.id,
      github_synced: true,
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced',
      deleted_at: null, // Clear deleted_at if restoring
    }));

    const { error: insertError } = await supabase
      .from('tag_mappings')
      .upsert(tagMappings, {
        onConflict: 'repo_connection_id,tag_name',
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error('Error inserting tag mappings:', insertError);
      return NextResponse.json({ error: 'Failed to import labels' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported: selectedLabels.length
    });
  } catch (error) {
    console.error('Error importing labels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
