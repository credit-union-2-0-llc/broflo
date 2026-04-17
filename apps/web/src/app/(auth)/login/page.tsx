"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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

const emailSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

const codeSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
});

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  useEffect(() => {
    if (step === "code" && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [step]);

  async function onSendCode(data: EmailForm) {
    setLoading(true);
    setError(null);

    try {
      await api.sendOtp(data.email);
      setEmail(data.email);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyCode(data: CodeForm) {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      code: data.code,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid or expired code.");
    } else {
      router.push("/dashboard");
    }
  }

  if (step === "code") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">broflo.</CardTitle>
          <CardDescription>
            We sent a code to {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={codeForm.handleSubmit(onVerifyCode)} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="text-center text-2xl tracking-[0.3em] font-mono"
                {...codeForm.register("code")}
                ref={(e) => {
                  codeForm.register("code").ref(e);
                  codeInputRef.current = e;
                }}
              />
              {codeForm.formState.errors.code && (
                <p className="text-sm text-destructive">
                  {codeForm.formState.errors.code.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Sign in"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStep("email");
              setError(null);
              codeForm.reset();
            }}
          >
            Use a different email
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">broflo.</CardTitle>
        <CardDescription>
          Sign in with your email
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={emailForm.handleSubmit(onSendCode)} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email && (
              <p className="text-sm text-destructive">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending code..." : "Send code"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
