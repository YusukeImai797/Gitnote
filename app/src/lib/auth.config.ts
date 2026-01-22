import { type AuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getServiceSupabase } from "@/lib/supabase";

export const authOptions: AuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          // Required scopes for repository access:
          // - repo: Full control of private repositories (read/write)
          // - read:user: Read user profile data
          // - user:email: Access user email addresses (even if private)
          scope: "repo read:user user:email",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[AUTH] signIn callback started:', {
        hasAccount: !!account,
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        userName: user?.name,
        providerAccountId: account?.providerAccountId,
        profileEmail: (profile as { email?: string })?.email,
      });

      if (!account) {
        console.error('[AUTH] No account provided');
        return false;
      }

      // Email can be null for users with private email settings
      // Use profile email as fallback, or generate a placeholder email using GitHub ID
      const email = user.email ||
        (profile as { email?: string })?.email ||
        `${account.providerAccountId}@users.noreply.github.com`;

      try {
        const supabase = getServiceSupabase();

        console.log('[AUTH] Attempting to upsert user:', {
          provider: 'github',
          provider_id: account.providerAccountId,
          email: email,
          name: user.name,
        });

        // Upsert user to database
        const { data, error } = await supabase
          .from('users')
          .upsert({
            provider: 'github',
            provider_id: account.providerAccountId,
            email: email,
            name: user.name,
          }, {
            onConflict: 'email'
          })
          .select();

        if (error) {
          console.error('[AUTH] Error upserting user:', {
            error,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          return false;
        }

        console.log('[AUTH] User upserted successfully:', data);
        return true;
      } catch (error) {
        console.error('[AUTH] Unexpected error in signIn callback:', error);
        return false;
      }
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
};
