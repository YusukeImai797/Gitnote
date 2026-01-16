import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { getOctokitForInstallation } from '@/lib/github';

// Get list of accessible repositories
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

    if (!installationId) {
      return NextResponse.json({ error: 'GitHub App not installed' }, { status: 400 });
    }

    const octokit = getOctokitForInstallation(Number(installationId));

    // Get all repositories accessible by this installation
    const { data } = await octokit.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    const repos = data.repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      description: repo.description,
    }));

    return NextResponse.json({ repos });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}
