"use client";

import { useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      router.push(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      router.push("/login?error=missing_code");
      return;
    }

    // Exchange the one-time auth code for tokens via POST (F-04: tokens never in URL)
    fetch(`${API_URL}/auth/oauth-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Exchange failed");
        return res.json();
      })
      .then((data) => {
        // Sign in via NextAuth credentials provider with the exchanged tokens
        return signIn("credentials", {
          redirect: false,
          email: data.user.email,
          password: `__oauth__:${data.accessToken}`,
          refreshToken: data.refreshToken,
        });
      })
      .then(() => {
        router.push("/dashboard");
      })
      .catch(() => {
        router.push("/login?error=oauth_failed");
      });
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
