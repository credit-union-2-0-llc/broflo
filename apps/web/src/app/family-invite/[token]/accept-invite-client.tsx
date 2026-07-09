"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

export function AcceptInviteClient({ token }: { token: string }) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!session?.accessToken) return;
    setAccepting(true);
    setError(null);
    try {
      await api.acceptFamilyInvite(session.accessToken, token);
      await update();
      router.push("/family");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept invite.");
      setAccepting(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleAccept} disabled={accepting} className="w-full">
        {accepting ? "Joining..." : "Join the family plan"}
      </Button>
    </div>
  );
}
