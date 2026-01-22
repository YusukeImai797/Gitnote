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
          scope: "repo read:user",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      try {
        const supabase = getServiceSupabase();

        console.log('[AUTH] Attempting to upsert user:', {
          github_user_id: account.providerAccountId,
          email: user.email,
          name: user.name,
        });

        // Upsert user to database
        const { data, error } = await supabase
          .from('users')
          .upsert({
            github_user_id: parseInt(account.providerAccountId, 10),
            email: user.email,
            name: user.name,
          }, {
            onConflict: 'github_user_id'
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
