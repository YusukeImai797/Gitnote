import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated This endpoint was used for GitHub App installation callbacks.
 * Since v0.4.0, we use OAuth authentication instead of GitHub App installation.
 * Users no longer need to install a GitHub App - they just sign in with GitHub OAuth.
 *
 * This endpoint is kept for backwards compatibility to handle any stale redirects,
 * but it simply redirects users to the setup page.
 */
export async function GET(request: NextRequest) {
  console.log('[DEPRECATED] GitHub App callback endpoint called - redirecting to setup');

  // Redirect to setup page - OAuth flow handles authentication now
  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/setup?info=oauth_migration`);
}
