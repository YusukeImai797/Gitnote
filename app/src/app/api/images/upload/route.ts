import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'png';
    const filename = `image-${timestamp}.${extension}`;
    const path = `images/${filename}`;

    // Upload to GitHub
    const octokit = getOctokitForInstallation(repoConnection.github_installation_id);
    const [owner, repo] = repoConnection.repo_full_name.split('/');

    const { data: uploadData } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Upload image: ${filename}`,
      content: base64,
      branch: repoConnection.default_branch,
    });

    // Get the raw URL for the image
    const imageUrl = `https://raw.githubusercontent.com/${repoConnection.repo_full_name}/${repoConnection.default_branch}/${path}`;

    return NextResponse.json({
      success: true,
      url: imageUrl,
      filename,
      path,
      sha: uploadData.content?.sha,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
