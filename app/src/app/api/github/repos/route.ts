import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { Octokit } from '@octokit/rest';

// Get list of accessible repositories for the authenticated user
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's GitHub OAuth token from session
  const accessToken = session.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: 'GitHub access token not found in session' }, { status: 401 });
  }

  try {
    // Initialize Octokit with user's OAuth token
    const octokit = new Octokit({
      auth: accessToken,
    });

    // Get repositories for the authenticated user
    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      direction: 'desc',
    });

    const repos = data.map(repo => ({
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

    // Handle specific OAuth errors
    if (error instanceof Error && error.message.includes('Bad credentials')) {
      return NextResponse.json({ error: 'GitHub token expired or invalid. Please sign in again.' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}
