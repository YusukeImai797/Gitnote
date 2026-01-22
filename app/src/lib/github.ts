import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

const appId = process.env.GITHUB_APP_ID!;
const privateKey = process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n');

/**
 * Get Octokit instance using GitHub App Installation ID
 * @deprecated Use getOctokitForUser for multi-user support
 */
export function getOctokitForInstallation(installationId: number) {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });

  return octokit;
}

/**
 * Get Octokit instance using user's OAuth access token
 * This allows each user to access their own repositories
 */
export function getOctokitForUser(accessToken: string) {
  const octokit = new Octokit({
    auth: accessToken,
  });

  return octokit;
}

export async function getInstallationAccessToken(installationId: number) {
  const auth = createAppAuth({
    appId,
    privateKey,
  });

  const installationAuth = await auth({
    type: 'installation',
    installationId,
  });

  return installationAuth.token;
}
