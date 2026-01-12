import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the installation URL format that works with App ID
  // This redirects to GitHub's installation page for the app
  const installUrl = `https://github.com/apps/install`;

  return NextResponse.redirect(installUrl);
}
