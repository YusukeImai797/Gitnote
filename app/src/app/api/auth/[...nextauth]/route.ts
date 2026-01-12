import NextAuth, { type AuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getServiceSupabase } from "@/lib/supabase";

export const authOptions: AuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      try {
        const supabase = getServiceSupabase();

        // Upsert user to database
        const { error } = await supabase
          .from('users')
          .upsert({
            github_user_id: parseInt(account.providerAccountId),
            email: user.email,
            name: user.name,
            avatar_url: user.image,
          }, {
            onConflict: 'github_user_id'
          });

        if (error) {
          console.error('Error upserting user:', error);
          return false;
        }

        return true;
      } catch (error) {
        console.error('Unexpected error in signIn callback:', error);
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
        // @ts-ignore
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
