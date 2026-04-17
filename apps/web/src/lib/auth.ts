import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { api } from "./api";

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null =
  null;

declare module "next-auth" {
  interface Session {
    accessToken: string;
    refreshToken: string;
    error?: "RefreshTokenError";
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
    accessTokenExpires: number;
    error?: "RefreshTokenError";
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

function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: {},
        code: {},
      },
      async authorize(credentials) {
        try {
          const result = await api.verifyOtp(
            credentials.email as string,
            credentials.code as string,
          );

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
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as Record<string, unknown>;
        token.accessToken = u.accessToken as string;
        token.refreshToken = u.refreshToken as string;
        token.accessTokenExpires = getTokenExpiry(u.accessToken as string);
        token.user = {
          id: u.id as string,
          email: u.email as string,
          name: u.name as string | null,
          avatarUrl: u.avatarUrl as string | null,
          subscriptionTier: u.subscriptionTier as string,
          brofloScore: u.brofloScore as number,
        };
      }

      if (Date.now() > (token.accessTokenExpires as number) - 60_000) {
        try {
          if (!refreshPromise) {
            refreshPromise = api
              .refresh(token.refreshToken as string)
              .finally(() => {
                refreshPromise = null;
              });
          }
          const refreshed = await refreshPromise;
          token.accessToken = refreshed.accessToken;
          token.refreshToken = refreshed.refreshToken;
          token.accessTokenExpires = getTokenExpiry(refreshed.accessToken);
          delete token.error;
        } catch {
          token.error = "RefreshTokenError";
          return token;
        }
      }

      if (trigger === "update" && token.accessToken) {
        try {
          const sub = await api.getSubscription(token.accessToken as string);
          (token.user as { subscriptionTier: string }).subscriptionTier =
            sub.subscriptionTier;
        } catch {
          // keep existing tier on failure
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.user = token.user as typeof session.user;
      if (token.error === "RefreshTokenError") {
        session.error = "RefreshTokenError";
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
