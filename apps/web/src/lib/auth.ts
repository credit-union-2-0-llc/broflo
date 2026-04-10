import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { api } from "./api";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      subscriptionTier: string;
      brofloScore: number;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
      subscriptionTier: string;
      brofloScore: number;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        try {
          const password = credentials.password as string;

          // OAuth exchange: callback page passes tokens via __oauth__ prefix
          if (password?.startsWith("__oauth__:")) {
            const accessToken = password.slice("__oauth__:".length);
            const me = await api.me(accessToken);
            // Fetch refresh token from the exchange response passed through
            // The callback stores the full exchange result
            return {
              id: me.id as string,
              email: me.email as string,
              name: me.name as string | null,
              accessToken,
              refreshToken: (credentials as Record<string, string>).refreshToken || "",
              avatarUrl: me.avatarUrl as string | null,
              subscriptionTier: me.subscriptionTier as string,
              brofloScore: me.brofloScore as number,
            };
          }

          const result = await api.login({
            email: credentials.email as string,
            password,
          });

          return {
            id: result.user.id as string,
            email: result.user.email as string,
            name: result.user.name as string | null,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            avatarUrl: result.user.avatarUrl as string | null,
            subscriptionTier: result.user.subscriptionTier as string,
            brofloScore: result.user.brofloScore as number,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as Record<string, unknown>;
        token.accessToken = u.accessToken as string;
        token.refreshToken = u.refreshToken as string;
        token.user = {
          id: u.id as string,
          email: u.email as string,
          name: u.name as string | null,
          avatarUrl: u.avatarUrl as string | null,
          subscriptionTier: u.subscriptionTier as string,
          brofloScore: u.brofloScore as number,
        };
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.user = token.user as typeof session.user;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
