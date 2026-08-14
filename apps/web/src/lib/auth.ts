import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { api } from "./api";

let refreshPromise: Promise<{
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}> | null = null;

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
      hasPassword: boolean;
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
      hasPassword: boolean;
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
        password: {},
        code: {},
      },
      async authorize(credentials) {
        try {
          const email = credentials.email as string;
          // Password is the primary path; an OTP code is the "email me a code
          // instead" fallback. Whichever field the form sent decides.
          const result = credentials.password
            ? await api.login(email, credentials.password as string)
            : await api.verifyOtp(email, credentials.code as string);

          return {
            id: result.user.id as string,
            email: result.user.email as string,
            name: result.user.name as string | null,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            avatarUrl: result.user.avatarUrl as string | null,
            subscriptionTier: result.user.subscriptionTier as string,
            hasPassword: result.user.hasPassword as boolean,
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
    async jwt({ token, user, trigger, session }) {
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
          hasPassword: u.hasPassword as boolean,
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

      if (trigger === "update") {
        const supplied = (session as { user?: { subscriptionTier?: string; hasPassword?: boolean } } | undefined)?.user;
        // After the "set a password" step, the client pushes hasPassword: true
        // so the set-password gate stops redirecting without a full re-login.
        if (supplied?.hasPassword !== undefined) {
          (token.user as { hasPassword: boolean }).hasPassword = supplied.hasPassword;
        }
        const suppliedTier = supplied?.subscriptionTier;
        if (suppliedTier) {
          // Fast path: the caller already knows the new tier (e.g. right
          // after a dev-tier-override switch or a family-invite accept) —
          // trust it directly instead of racing a re-fetch against a
          // possibly still-refreshing access token.
          (token.user as { subscriptionTier: string }).subscriptionTier = suppliedTier;
        } else if (token.accessToken) {
          try {
            const sub = await api.getSubscription(token.accessToken as string);
            (token.user as { subscriptionTier: string }).subscriptionTier =
              sub.subscriptionTier;
          } catch {
            // keep existing tier on failure
          }
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
