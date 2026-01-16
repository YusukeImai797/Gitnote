import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

// GET /api/notes/:id - Get a specific note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
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

    // Get note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Get repo connection
    const { data: repoConnection } = await supabase
      .from('repo_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!repoConnection) {
      return NextResponse.json({ note, content: '' });
    }

    // Fetch content from GitHub
    try {
      const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
      const [owner, repo] = repoConnection.repo_full_name.split('/');

      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: note.path,
        ref: repoConnection.default_branch,
      });

      if ('content' in fileData) {
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

        // Remove front matter
        const contentWithoutFrontMatter = content.replace(/^---\n[\s\S]*?\n---\n\n?/, '');

        return NextResponse.json({
          note,
          content: contentWithoutFrontMatter,
        });
      }
    } catch (error) {
      console.error('Error fetching content from GitHub:', error);
    }

    return NextResponse.json({ note, content: '' });
  } catch (error) {
    console.error('Error in GET /api/notes/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/notes/:id - Update a note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, tags = [], saveToDbOnly = false } = body;

    console.log('[SYNC] PUT request received:', {
      noteId: id,
      saveToDbOnly,
      titleLength: title?.length || 0,
      contentLength: content?.length || 0,
      tagsCount: tags.length,
    });

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

    // Get note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Get repo connection
    const { data: repoConnection } = await supabase
      .from('repo_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!repoConnection) {
      return NextResponse.json({ error: 'No active repository connection' }, { status: 400 });
    }

    // If saveToDbOnly, just update the database without GitHub commit
    if (saveToDbOnly) {
      const { data: updatedNote, error: updateError } = await supabase
        .from('notes')
        .update({
          title: title || note.title,
          content: content || note.content || '',
          tags,
          word_count: content?.split(/\s+/).length || 0,
          updated_at: new Date().toISOString(), // Explicitly set for multi-device sync
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating note in database:', updateError);
        return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
      }

      return NextResponse.json({ note: updatedNote, status: 'draft' });
    }

    // For notes without a path yet (new drafts), create the file first
    if (!note.path) {
      // Get folder path
      let targetPath = 'notes/';
      if (note.folder_path_id) {
        const { data: folderPath } = await supabase
          .from('folder_paths')
          .select('path')
          .eq('id', note.folder_path_id)
          .single();
        if (folderPath) {
          targetPath = folderPath.path;
        }
      }

      // Generate filename from title
      const filename = (title || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);

      const timestamp = Date.now();
      const filePath = `${targetPath}${filename}-${timestamp}.md`;

      // Update note path in database first
      await supabase
        .from('notes')
        .update({ path: filePath })
        .eq('id', id);

      note.path = filePath;
    }

    // Update markdown with front matter
    const frontMatter = [
      '---',
      `title: "${title || note.title}"`,
      `tags: [${tags.map((t: string) => `"${t}"`).join(', ')}]`,
      `created_at: "${note.created_at}"`,
      `updated_at: "${new Date().toISOString()}"`,
      '---',
      '',
    ].join('\n');

    const fullContent = frontMatter + content;

    // Update on GitHub
    const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
    const [owner, repo] = repoConnection.repo_full_name.split('/');

    // Always get the latest file state from GitHub to detect conflicts
    let sha = note.last_commit_sha;
    let remoteContent: string | null = null;

    console.log('[SYNC] Fetching current file from GitHub:', {
      notePath: note.path,
      localSha: sha,
    });

    try {
      const { data: existingFile } = await octokit.repos.getContent({
        owner,
        repo,
        path: note.path,
        ref: repoConnection.default_branch,
      });
      if ('sha' in existingFile && 'content' in existingFile) {
        const currentSha = existingFile.sha;
        remoteContent = Buffer.from(existingFile.content, 'base64').toString('utf-8');

        console.log('[SYNC] Remote file fetched:', {
          remoteSha: currentSha,
          remoteContentLength: remoteContent.length,
          shaMatch: sha === currentSha,
        });

        // If local sha doesn't match remote sha, we may have a conflict
        if (sha && sha !== currentSha) {
          console.log('[SYNC] SHA mismatch detected, comparing content...');

          // Extract and compare the actual content (body without front matter)
          const extractBody = (c: string) =>
            c.replace(/^---\n[\s\S]*?\n---\n\n?/, '').trim();

          const remoteBody = extractBody(remoteContent);
          const localBody = extractBody(fullContent);

          // Extract front matter fields for comparison
          const extractTitle = (c: string) => {
            const match = c.match(/title: "([^"]*)"/);
            return match ? match[1] : '';
          };
          const extractTags = (c: string) => {
            const match = c.match(/tags: \[([^\]]*)\]/);
            return match ? match[1] : '';
          };

          const remoteTitle = extractTitle(remoteContent);
          const localTitle = extractTitle(fullContent);
          const remoteTags = extractTags(remoteContent);
          const localTags = extractTags(fullContent);

          const bodyMatch = remoteBody === localBody;
          const titleMatch = remoteTitle === localTitle;
          const tagsMatch = remoteTags === localTags;

          console.log('[SYNC] Content comparison:', {
            bodyMatch,
            titleMatch,
            tagsMatch,
            remoteBodyPreview: remoteBody.substring(0, 80) + (remoteBody.length > 80 ? '...' : ''),
            localBodyPreview: localBody.substring(0, 80) + (localBody.length > 80 ? '...' : ''),
          });

          // If all meaningful content is the same, no conflict
          if (bodyMatch && titleMatch && tagsMatch) {
            console.log('[SYNC] Content identical, updating SHA without conflict');
            sha = currentSha;
          } else {
            // Actual content conflict
            console.log('[SYNC] Content differs, returning conflict response');
            return NextResponse.json({
              error: 'Conflict detected',
              remoteContent: remoteBody,
              status: 'conflict'
            }, { status: 409 });
          }
        } else {
          console.log('[SYNC] SHA matches or no previous SHA, proceeding with update');
          sha = currentSha;
        }
      }
    } catch (error) {
      console.log('[SYNC] File does not exist yet, creating new file');
      // File doesn't exist yet, that's fine for new notes
    }

    const { data: fileData } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: note.path,
      message: sha ? `Update note: ${title || note.title}` : `Create note: ${title || note.title}`,
      content: Buffer.from(fullContent).toString('base64'),
      branch: repoConnection.default_branch,
      ...(sha ? { sha } : {}),
    });

    // Update note metadata
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        title: title || note.title,
        content: content || '',
        tags,
        word_count: content?.split(/\s+/).length || 0,
        last_commit_sha: fileData.commit.sha,
        status: 'synced',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating note metadata:', updateError);
      return NextResponse.json({ error: 'Failed to update note metadata' }, { status: 500 });
    }

    return NextResponse.json({ note: updatedNote, status: 'synced' });
  } catch (error: any) {
    console.error('Error in PUT /api/notes/:id:', error);

    // Check for conflict
    if (error.status === 409) {
      return NextResponse.json({ error: 'Conflict detected', status: 'conflict' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
