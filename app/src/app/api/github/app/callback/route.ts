import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getServiceSupabase } from '@/lib/supabase';
import { getOctokitForInstallation } from '@/lib/github';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}?error=unauthorized`);
  }

  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');

  if (!installationId) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}?error=missing_installation_id`);
  }

  try {
    const supabase = getServiceSupabase();

    // Get user ID from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}?error=user_not_found`);
    }

    // Get installation details from GitHub
    const octokit = getOctokitForInstallation(Number(installationId));
    const { data: installation } = await octokit.apps.getInstallation({
      installation_id: Number(installationId),
    });

    // Get repositories accessible by this installation
    const { data: reposData } = await octokit.apps.listReposAccessibleToInstallation({
      per_page: 1,
    });

    const firstRepo = reposData.repositories[0];

    if (!firstRepo) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}?error=no_repos_found`);
    }

    // Store or update the repo connection
    const { error: repoError } = await supabase
      .from('repo_connections')
      .upsert({
        user_id: user.id,
        provider: 'github',
        installation_id: installationId,
        repo_full_name: firstRepo.full_name,
        default_branch: firstRepo.default_branch || 'main',
        base_path: 'notes',
        status: 'active',
      }, {
        onConflict: 'user_id,provider'
      });

    if (repoError) {
      console.error('Error saving repo connection:', repoError);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}?error=failed_to_save`);
    }

    // Redirect to setup page or home
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/setup?success=true`);
  } catch (error) {
    console.error('Error in GitHub App callback:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}?error=installation_failed`);
  }
}
