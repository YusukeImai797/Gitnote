import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForUser } from '@/lib/github';

// GET /api/notes - List all notes
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

    // Get notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error) {
    console.error('Error in GET /api/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notes - Create a new note
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = session.accessToken as string;

  try {
    const body = await request.json();
    const { title, content, tags = [], folder_path_id } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
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

    // Determine file path based on folder_path_id or default
    let targetPath = 'notes/';
    let folderPathId = folder_path_id || null;

    if (folder_path_id) {
      // Get folder path from folder_paths table
      const { data: folderPath } = await supabase
        .from('folder_paths')
        .select('path')
        .eq('id', folder_path_id)
        .eq('repo_connection_id', repoConnection.id)
        .single();

      if (folderPath) {
        targetPath = folderPath.path;
      }
    } else {
      // Get default folder path
      const { data: defaultFolder } = await supabase
        .from('folder_paths')
        .select('*')
        .eq('repo_connection_id', repoConnection.id)
        .eq('is_default', true)
        .single();

      if (defaultFolder) {
        targetPath = defaultFolder.path;
        folderPathId = defaultFolder.id;
      }
    }

    // Generate filename from title
    const filename = title
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    const timestamp = Date.now();
    const filePath = `${targetPath}${filename}-${timestamp}.md`;

    // Create markdown with front matter
    const frontMatter = [
      '---',
      `title: "${title}"`,
      `tags: [${tags.map((t: string) => `"${t}"`).join(', ')}]`,
      `created_at: "${new Date().toISOString()}"`,
      `updated_at: "${new Date().toISOString()}"`,
      '---',
      '',
    ].join('\n');

    const fullContent = frontMatter + content;

    // Upload to GitHub
    const octokit = getOctokitForUser(accessToken);
    const [owner, repo] = repoConnection.repo_full_name.split('/');

    const { data: fileData } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Create note: ${title}`,
      content: Buffer.from(fullContent).toString('base64'),
      branch: repoConnection.default_branch,
    });

    // Save note metadata to database
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        repo_connection_id: repoConnection.id,
        folder_path_id: folderPathId,
        title,
        path: filePath,
        tags,
        word_count: content?.split(/\s+/).length || 0,
        last_commit_sha: fileData.commit.sha,
        status: 'synced',
      })
      .select()
      .single();

    if (noteError) {
      console.error('Error saving note metadata:', noteError);
      return NextResponse.json({ error: 'Failed to save note metadata' }, { status: 500 });
    }

    return NextResponse.json({ note, status: 'synced' });
  } catch (error) {
    console.error('Error in POST /api/notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
