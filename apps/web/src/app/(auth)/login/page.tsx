"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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

type Mode = "password" | "otp-email" | "otp-code";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      // authorize() can only signal pass/fail, so re-run login to surface the
      // specific reason (e.g. "verify your email first") for the message.
      try {
        await api.login(email, password);
        setError("Something went wrong signing you in. Try again.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid email or password.");
      }
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.sendOtp(email);
      setMode("otp-code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", { email, code, redirect: false });
    if (result?.error) {
      setError("Invalid or expired code.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">broflo.</CardTitle>
        <CardDescription>
          {mode === "otp-code" ? (
            <>We sent a code to <span className="font-medium text-foreground">{email}</span></>
          ) : (
            "Sign in to your account"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-destructive text-center">{error}</p>}

        {mode === "password" && (
          <form onSubmit={onPasswordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        )}

        {mode === "otp-email" && (
          <form onSubmit={onSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp-email">Email</Label>
              <Input id="otp-email" type="email" autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending code..." : "Send code"}
            </Button>
          </form>
        )}

        {mode === "otp-code" && (
          <form onSubmit={onVerifyCode} className="space-y-4">
            <input type="hidden" autoComplete="username" value={email} readOnly />
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input id="code" type="text" inputMode="numeric" autoComplete="one-time-code"
                maxLength={6} placeholder="000000"
                className="text-center text-2xl tracking-[0.3em] font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Sign in"}
            </Button>
          </form>
        )}

        <div className="mt-4 space-y-2 text-center text-sm">
          {mode === "password" ? (
            <button type="button" onClick={() => { setMode("otp-email"); setError(null); }}
              className="text-muted-foreground hover:text-foreground">
              Email me a code instead
            </button>
          ) : (
            <button type="button" onClick={() => { setMode("password"); setError(null); }}
              className="text-muted-foreground hover:text-foreground">
              Use a password instead
            </button>
          )}
          <p className="text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-foreground hover:underline">Sign up</Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
