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
    const { mappings } = body;

    if (!Array.isArray(mappings)) {
      return NextResponse.json({ error: 'Invalid mappings data' }, { status: 400 });
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

    // Update each mapping
    for (const mapping of mappings) {
      const { error: updateError } = await supabase
        .from('tag_mappings')
        .update({
          target_path: mapping.target_path,
        })
        .eq('id', mapping.id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating mapping:', updateError);
        return NextResponse.json({ error: 'Failed to update mappings' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating mappings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
