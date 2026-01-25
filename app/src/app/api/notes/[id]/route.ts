import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForUser } from '@/lib/github';

// GET /api/notes/:id - Get a specific note
// Optimized: Returns Supabase content immediately without waiting for GitHub
export async function GET(
  _request: NextRequest,
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

    // Get note with content from Supabase (fast, no GitHub API call)
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Return Supabase content immediately (no GitHub fetch for faster UX)
    // GitHub sync happens on save, not on load
    return NextResponse.json({
      note,
      content: note.content || '',
    });
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

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized - missing access token' }, { status: 401 });
  }

  const accessToken = session.accessToken as string;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, tags = [], saveToDbOnly = false, expected_updated_at } = body;

    console.log('[SYNC] PUT request received:', {
      noteId: id,
      saveToDbOnly,
      titleLength: title?.length || 0,
      contentLength: content?.length || 0,
      tagsCount: tags.length,
      expected_updated_at,
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
      // Optimistic locking: check if server was updated since client's last sync
      // Use a tolerance window to handle network delays and clock differences
      const TIMESTAMP_TOLERANCE_MS = 5000; // 5 seconds tolerance

      if (expected_updated_at) {
        const currentServerUpdatedAt = new Date(note.updated_at || 0).getTime();
        // Only conflict if server is significantly newer (beyond tolerance window)
        // This prevents false conflicts from network delays or same-device saves
        if (currentServerUpdatedAt > expected_updated_at + TIMESTAMP_TOLERANCE_MS) {
          console.log('[SYNC] Optimistic lock conflict (beyond tolerance):', {
            expected: expected_updated_at,
            actual: currentServerUpdatedAt,
            tolerance: TIMESTAMP_TOLERANCE_MS,
            diff: currentServerUpdatedAt - expected_updated_at,
          });
          return NextResponse.json({
            error: 'Conflict detected',
            status: 'conflict',
            serverNote: note,
          }, { status: 409 });
        }
        // Log if within tolerance (helpful for debugging)
        if (currentServerUpdatedAt > expected_updated_at) {
          console.log('[SYNC] Timestamp diff within tolerance, allowing save:', {
            expected: expected_updated_at,
            actual: currentServerUpdatedAt,
            diff: currentServerUpdatedAt - expected_updated_at,
          });
        }
      }

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

    // Helper to normalize content for comparison (removes trailing whitespace, normalizes line endings)
    const normalizeContent = (c: string) =>
      c.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();

    // Helper to extract body without front matter
    const extractBody = (c: string) =>
      c.replace(/^---\n[\s\S]*?\n---\n\n?/, '').trim();

    // Determine if we need to update updated_at in front matter
    // Only update if actual content (title, body, tags) has changed
    let frontMatterUpdatedAt = note.updated_at || new Date().toISOString();

    // We'll check against remote content later if available, for now use note's timestamp
    let shouldUpdateTimestamp = false;

    // Update markdown with front matter
    const buildFrontMatter = (updatedAtValue: string) => [
      '---',
      `title: "${title || note.title}"`,
      `tags: [${tags.map((t: string) => `"${t}"`).join(', ')}]`,
      `created_at: "${note.created_at}"`,
      `updated_at: "${updatedAtValue}"`,
      '---',
      '',
    ].join('\n');

    // Initial front matter with existing timestamp (may be updated later)
    let frontMatter = buildFrontMatter(frontMatterUpdatedAt);
    let fullContent = frontMatter + content;

    // Update on GitHub using user's OAuth token
    const octokit = getOctokitForUser(accessToken);
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

        // Extract front matter fields for comparison
        const extractTitle = (c: string) => {
          const match = c.match(/title: "([^"]*)"/);
          return match ? match[1] : '';
        };
        const extractTags = (c: string) => {
          const match = c.match(/tags: \[([^\]]*)\]/);
          return match ? match[1] : '';
        };
        const extractUpdatedAt = (c: string) => {
          const match = c.match(/updated_at: "([^"]*)"/);
          return match ? match[1] : '';
        };

        // Compare actual content with normalization (handle CRLF/LF differences)
        const remoteBody = normalizeContent(extractBody(remoteContent));
        const localBody = normalizeContent(extractBody(fullContent));
        const remoteTitle = extractTitle(remoteContent);
        const localTitle = extractTitle(fullContent);
        const remoteTags = extractTags(remoteContent);
        const localTags = extractTags(fullContent);
        const remoteUpdatedAt = extractUpdatedAt(remoteContent);

        const bodyMatch = remoteBody === localBody;
        const titleMatch = remoteTitle === localTitle;
        const tagsMatch = remoteTags === localTags;
        const contentActuallyChanged = !bodyMatch || !titleMatch || !tagsMatch;

        console.log('[SYNC] Content comparison:', {
          bodyMatch,
          titleMatch,
          tagsMatch,
          contentActuallyChanged,
          remoteBodyPreview: remoteBody.substring(0, 80) + (remoteBody.length > 80 ? '...' : ''),
          localBodyPreview: localBody.substring(0, 80) + (localBody.length > 80 ? '...' : ''),
        });

        // If local sha doesn't match remote sha, we may have a conflict
        if (sha && sha !== currentSha) {
          console.log('[SYNC] SHA mismatch detected');

          // If all meaningful content is the same, no conflict - just use current SHA
          if (!contentActuallyChanged) {
            console.log('[SYNC] Content identical despite SHA mismatch - no actual conflict');
            // Preserve remote's updated_at to avoid unnecessary SHA changes
            frontMatterUpdatedAt = remoteUpdatedAt || frontMatterUpdatedAt;
            frontMatter = buildFrontMatter(frontMatterUpdatedAt);
            fullContent = frontMatter + content;
            sha = currentSha;
          } else {
            // Actual content conflict
            console.log('[SYNC] Content differs, returning conflict response');
            return NextResponse.json({
              error: 'Conflict detected',
              remoteContent: extractBody(remoteContent),
              status: 'conflict'
            }, { status: 409 });
          }
        } else {
          console.log('[SYNC] SHA matches or no previous SHA');
          sha = currentSha;

          // Only update timestamp if content actually changed
          if (contentActuallyChanged) {
            console.log('[SYNC] Content changed, updating timestamp');
            frontMatterUpdatedAt = new Date().toISOString();
            frontMatter = buildFrontMatter(frontMatterUpdatedAt);
            fullContent = frontMatter + content;
            shouldUpdateTimestamp = true;
          } else {
            // Preserve existing timestamp to avoid SHA churn
            console.log('[SYNC] Content unchanged, preserving timestamp');
            frontMatterUpdatedAt = remoteUpdatedAt || frontMatterUpdatedAt;
            frontMatter = buildFrontMatter(frontMatterUpdatedAt);
            fullContent = frontMatter + content;
          }
        }
      }
    } catch (error: any) {
      // Check if it's a 404 (file doesn't exist) - that's normal for new files
      if (error.status === 404) {
        console.log('[SYNC] File does not exist yet (404), will create new file:', {
          path: note.path,
        });
        // sha stays undefined, which tells createOrUpdateFileContents to create new file
      } else {
        // Other errors should be logged and handled
        console.error('[SYNC] Error fetching file from GitHub:', {
          status: error.status,
          message: error.message,
          path: note.path,
        });
        // Continue anyway - we'll try to create/update the file
      }
    }

    console.log('[SYNC] Creating/updating file on GitHub:', {
      path: note.path,
      hasSha: !!sha,
      sha: sha?.substring(0, 7),
      branch: repoConnection.default_branch,
    });

    let fileData;
    try {
      const response = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: note.path,
        message: sha ? `Update note: ${title || note.title}` : `Create note: ${title || note.title}`,
        content: Buffer.from(fullContent).toString('base64'),
        branch: repoConnection.default_branch,
        ...(sha ? { sha } : {}),
      });
      fileData = response.data;
      console.log('[SYNC] File created/updated successfully:', {
        commitSha: fileData.commit?.sha?.substring(0, 7),
        path: note.path,
      });
    } catch (githubError: any) {
      console.error('[SYNC] GitHub createOrUpdateFileContents error:', {
        status: githubError.status,
        message: githubError.message,
        response: githubError.response?.data,
        path: note.path,
        hasSha: !!sha,
      });

      // Provide specific error messages
      if (githubError.status === 409) {
        return NextResponse.json({
          error: 'Conflict detected - file was modified',
          status: 'conflict',
          code: 'GITHUB_CONFLICT'
        }, { status: 409 });
      }
      if (githubError.status === 404) {
        return NextResponse.json({
          error: 'Repository or branch not found. Please check your repository connection.',
          details: githubError.message,
          code: 'REPO_NOT_FOUND'
        }, { status: 404 });
      }
      if (githubError.status === 422) {
        return NextResponse.json({
          error: 'Failed to save file. The file path may be invalid.',
          details: githubError.message,
          code: 'UNPROCESSABLE_ENTITY'
        }, { status: 422 });
      }
      if (githubError.status === 403) {
        return NextResponse.json({
          error: 'Permission denied. The GitHub App may need additional permissions.',
          details: githubError.message,
          code: 'PERMISSION_DENIED'
        }, { status: 403 });
      }

      return NextResponse.json({
        error: 'Failed to save file to GitHub',
        details: githubError.message,
        code: 'GITHUB_API_ERROR'
      }, { status: 500 });
    }

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
    console.error('[SYNC] Unexpected error in PUT /api/notes/:id:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      status: error.status,
    });

    // Check for conflict
    if (error.status === 409) {
      return NextResponse.json({
        error: 'Conflict detected',
        status: 'conflict',
        code: 'CONFLICT'
      }, { status: 409 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error.message,
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
