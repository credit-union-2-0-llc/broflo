"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";

// The gate OTP-created accounts (which have no password) hit on next sign-in.
// The (app) layout redirects here whenever the session's hasPassword is false.
export default function SetPasswordPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }
  // Already has a password — nothing to do here.
  if (session?.user?.hasPassword) {
    router.replace("/dashboard");
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!session?.accessToken) {
      setError("Your session expired. Sign in again.");
      return;
    }
    setLoading(true);
    try {
      await api.setPassword(session.accessToken, password);
      await update({ user: { hasPassword: true } });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set your password. Try again.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Set a password</CardTitle>
        <CardDescription>
          Add a password so you can sign in without a code next time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-destructive text-center">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
