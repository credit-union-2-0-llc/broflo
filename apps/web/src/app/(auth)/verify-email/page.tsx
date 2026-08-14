"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token");
  // Derive the starting state from the token so we never setState synchronously
  // inside the effect for the missing-token case.
  const [state, setState] = useState<"verifying" | "success" | "error">(
    token ? "verifying" : "error",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .verifyEmail(token)
      .then(() => { if (!cancelled) setState("success"); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          {state === "verifying" && "Confirming your email..."}
          {state === "success" && "Email confirmed"}
          {state === "error" && "Link expired"}
        </CardTitle>
        <CardDescription>
          {state === "verifying" && "One moment."}
          {state === "success" && "You're all set. Sign in to get started."}
          {state === "error" && "This link is invalid or has expired. Request a new one from the sign-in page."}
        </CardDescription>
      </CardHeader>
      {state !== "verifying" && (
        <CardContent className="text-center text-sm">
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
