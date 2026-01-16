import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

// POST /api/labels/sync - Sync labels from GitHub
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'No active repository connection' }, { status: 400 });
    }

    // Fetch labels from GitHub
    const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
    const [owner, repo] = repoConnection.repo_full_name.split('/');

    const { data: githubLabels } = await octokit.issues.listLabelsForRepo({
      owner,
      repo,
      per_page: 100,
    });

    // Get existing label mappings
    const { data: existingMappings } = await supabase
      .from('tag_mappings')
      .select('*')
      .eq('repo_connection_id', repoConnection.id)
      .is('deleted_at', null);

    const existingLabelNames = new Set(
      (existingMappings || []).map(m => m.tag_name)
    );
    const githubLabelNames = new Set(githubLabels.map(l => l.name));

    // Find new labels from GitHub
    const newLabels = githubLabels.filter(
      label => !existingLabelNames.has(label.name)
    );

    // Find labels to update (existed before and still exist on GitHub)
    const labelsToUpdate = githubLabels.filter(
      label => existingLabelNames.has(label.name)
    );

    // Find labels to soft-delete (exist locally but not on GitHub)
    const labelsToDelete = (existingMappings || []).filter(
      mapping => !githubLabelNames.has(mapping.tag_name) && !mapping.is_default
    );

    // Insert new labels
    if (newLabels.length > 0) {
      const newMappings = newLabels.map(label => ({
        user_id: user.id,
        repo_connection_id: repoConnection.id,
        tag_name: label.name,
        target_path: `notes/${label.name}/`,
        color: `#${label.color}`,
        description: label.description || '',
        github_label_id: label.id,
        github_synced: true,
        last_synced_at: new Date().toISOString(),
      }));

      await supabase.from('tag_mappings').insert(newMappings);
    }

    // Update existing labels (color, description)
    for (const label of labelsToUpdate) {
      const existing = existingMappings?.find(m => m.tag_name === label.name);
      if (existing) {
        await supabase
          .from('tag_mappings')
          .update({
            color: `#${label.color}`,
            description: label.description || existing.description,
            github_label_id: label.id,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
    }

    // Soft delete labels that no longer exist on GitHub
    if (labelsToDelete.length > 0) {
      await supabase
        .from('tag_mappings')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', labelsToDelete.map(l => l.id));
    }

    return NextResponse.json({
      message: 'Labels synced successfully',
      added: newLabels.length,
      updated: labelsToUpdate.length,
      deleted: labelsToDelete.length,
    });
  } catch (error) {
    console.error('Error in POST /api/labels/sync:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
