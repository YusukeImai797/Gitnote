import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';

// GET /api/drafts - Get the latest draft for the current user/repo
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

    // Check if looking for specific note draft
    const noteId = request.nextUrl.searchParams.get('noteId');

    let query = supabase
      .from('drafts')
      .select('*')
      .eq('user_id', user.id)
      .eq('repo_connection_id', repoConnection.id);

    if (noteId) {
      query = query.eq('note_id', noteId);
    } else {
      query = query.is('note_id', null);
    }

    const { data: draft, error: draftError } = await query
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (draftError) {
      // No draft found is not an error
      if (draftError.code === 'PGRST116') {
        return NextResponse.json({ draft: null });
      }
      throw draftError;
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
  }
}

// POST /api/drafts - Create or update a draft
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { noteId, title, content, tags, folderPath } = body;

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

    // Prepare draft data
    const draftData = {
      user_id: user.id,
      repo_connection_id: repoConnection.id,
      note_id: noteId || null,
      title: title || '',
      content: content || '',
      tags: tags || [],
      folder_path: folderPath || null,
    };

    // Upsert draft
    const { data: draft, error: saveError } = await supabase
      .from('drafts')
      .upsert(draftData, {
        onConflict: noteId ? 'user_id,repo_connection_id,note_id' : undefined,
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving draft:', saveError);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('Error in POST /api/drafts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/drafts - Delete a draft
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const noteId = request.nextUrl.searchParams.get('noteId');
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

    // Delete draft
    let query = supabase
      .from('drafts')
      .delete()
      .eq('user_id', user.id)
      .eq('repo_connection_id', repoConnection.id);

    if (noteId) {
      query = query.eq('note_id', noteId);
    } else {
      query = query.is('note_id', null);
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      console.error('Error deleting draft:', deleteError);
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/drafts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
