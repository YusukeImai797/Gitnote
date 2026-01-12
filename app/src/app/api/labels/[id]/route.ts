import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';

// DELETE /api/labels/:id - Delete (soft delete) a label
export async function DELETE(
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

    // Get the label to verify ownership and check if it's default
    const { data: label, error: labelError } = await supabase
      .from('tag_mappings')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (labelError || !label) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 });
    }

    if (label.is_default) {
      return NextResponse.json({ error: 'Cannot delete default label' }, { status: 400 });
    }

    // Soft delete the label
    const { error: deleteError } = await supabase
      .from('tag_mappings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting label:', deleteError);
      return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/labels/:id:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
