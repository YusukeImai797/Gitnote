import { type AuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getServiceSupabase } from "@/lib/supabase";

export const authOptions: AuthOptions = {
  debug: true,
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

        // 1. Check if user exists by github_user_id (Legacy Schema)
        // Schema mismatch detected: provider_id does not exist. Using github_user_id.
        const { data: users, error: searchError } = await supabase
          .from('users')
          .select('id, email')
          .eq('github_user_id', parseInt(account.providerAccountId, 10))
          .limit(1);

        if (searchError) {
          console.error('[AUTH] Error searching user:', searchError);
          // If github_user_id also doesn't exist, this will fail.
          return false;
        }

        const existingUser = users?.[0];

        if (existingUser) {
          // 2. User exists - update details
          console.log('[AUTH] User exists, updating:', existingUser.id);

          const { error: updateError } = await supabase
            .from('users')
            .update({
              email: email, // Update email if changed
              name: user.name,
            })
            .eq('id', existingUser.id);

          if (updateError) {
            console.error('[AUTH] Error updating user:', updateError);
            return false;
          }
        } else {
          // 3. User does not exist by github_user_id - check by email to link accounts
          const { data: emailUsers, error: emailSearchError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .limit(1);

          if (emailSearchError) {
            console.error('[AUTH] Error searching user by email:', emailSearchError);
            return false;
          }

          const emailUser = emailUsers?.[0];

          if (emailUser) {
            // Link existing email user to this GitHub account
            console.log('[AUTH] Linking existing email user:', emailUser.id);
            const { error: linkError } = await supabase
              .from('users')
              .update({
                github_user_id: parseInt(account.providerAccountId, 10),
                name: user.name,
              })
              .eq('id', emailUser.id);

            if (linkError) {
              console.error('[AUTH] Error linking user:', linkError);
              return false;
            }
          } else {
            // 4. Create new user
            console.log('[AUTH] Creating new user (Legacy Schema)');
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                github_user_id: parseInt(account.providerAccountId, 10),
                email: email,
                name: user.name
                // Removing 'provider' field as it likely doesn't exist either
              });

            if (insertError) {
              console.error('[AUTH] Error inserting user:', insertError);
              return false;
            }
          }
        }

        console.log('[AUTH] User authenticated successfully');
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
