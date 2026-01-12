import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';

// PUT /api/folders/:id - Update a folder's alias
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
        const { alias, is_default } = body;

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

        // Check folder exists and belongs to user
        const { data: folder, error: folderError } = await supabase
            .from('folder_paths')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (folderError || !folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
        }

        // If setting as default, reset other defaults first
        if (is_default) {
            await supabase
                .from('folder_paths')
                .update({ is_default: false })
                .eq('repo_connection_id', folder.repo_connection_id);
        }

        // Update folder
        const updateData: { alias?: string | null; is_default?: boolean } = {};
        if (alias !== undefined) updateData.alias = alias || null;
        if (is_default !== undefined) updateData.is_default = is_default;

        const { data: updated, error: updateError } = await supabase
            .from('folder_paths')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating folder:', updateError);
            return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
        }

        return NextResponse.json({ folder: updated });
    } catch (error) {
        console.error('Error in PUT /api/folders/:id:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/folders/:id - Delete a folder path
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

        // Delete folder (only if belongs to user)
        const { error: deleteError } = await supabase
            .from('folder_paths')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('Error deleting folder:', deleteError);
            return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/folders/:id:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
