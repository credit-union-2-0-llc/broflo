"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PiggyBank, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { GiftPoolSummary } from "@/lib/api";
import { toast } from "sonner";

interface GiftPoolSectionProps {
  token: string;
  myUserId: string;
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export function GiftPoolSection({ token, myUserId }: GiftPoolSectionProps) {
  const searchParams = useSearchParams();
  const [pools, setPools] = useState<GiftPoolSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [creating, setCreating] = useState(false);
  const [contributeAmount, setContributeAmount] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const result = await api.listGiftPools(token);
      setPools(result);
    } catch {
      // leave list empty
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Deep-link prefill for the "New Pool" fields below — e.g. the
  // family-pool auto-nudge notification for a big-ticket Autopilot pick
  // links here with ?prefillTitle=...&prefillTargetCents=... so starting a
  // pool for that gift is a single click into the existing create-pool
  // flow, not a form the recipient has to fill in from scratch.
  useEffect(() => {
    const prefillTitle = searchParams.get("prefillTitle");
    const prefillTargetCents = searchParams.get("prefillTargetCents");
    if (prefillTitle) setTitle(prefillTitle.slice(0, 100));
    if (prefillTargetCents) {
      const cents = parseInt(prefillTargetCents, 10);
      if (Number.isFinite(cents) && cents > 0) setTarget((cents / 100).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!title.trim() || !target) return;
    setCreating(true);
    try {
      const targetCents = Math.round(parseFloat(target) * 100);
      await api.createGiftPool(token, title.trim(), targetCents);
      toast.success("Pool created.");
      setTitle("");
      setTarget("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create pool.");
    } finally {
      setCreating(false);
    }
  }

  async function handleContribute(poolId: string) {
    const amount = contributeAmount[poolId];
    if (!amount) return;
    setBusyId(poolId);
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      await api.addGiftPoolContribution(token, poolId, amountCents);
      toast.success("Chipped in!");
      setContributeAmount((prev) => ({ ...prev, [poolId]: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to chip in.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(poolId: string, contributionId: string) {
    setBusyId(contributionId);
    try {
      await api.deleteGiftPoolContribution(token, poolId, contributionId);
      toast.success("Removed your contribution.");
      await load();
    } catch {
      toast.error("Failed to remove contribution.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <PiggyBank className="h-4 w-4" />
          Group Gift Chip-In
        </CardTitle>
        <CardDescription>Pool money together for a bigger gift.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loading && pools.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No pools yet — start one below.
          </p>
        )}

        {pools.map((pool) => {
          const pct = Math.min(100, Math.round((pool.totalCents / pool.targetCents) * 100));
          return (
            <div key={pool.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{pool.title}</p>
                <p className="text-xs text-muted-foreground">
                  {dollars(pool.totalCents)} / {dollars(pool.targetCents)}
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-amber transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {pool.contributions.length > 0 && (
                <div className="space-y-1">
                  {pool.contributions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {c.contributorName} — {dollars(c.amountCents)}
                        {c.note ? ` (${c.note})` : ""}
                      </span>
                      {c.userId === myUserId && (
                        <button
                          onClick={() => handleDelete(pool.id, c.id)}
                          disabled={busyId === c.id}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {pool.status === "open" && (
                <div className="flex gap-2 pt-1">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      className="pl-6"
                      placeholder="Chip in amount"
                      value={contributeAmount[pool.id] ?? ""}
                      onChange={(e) => setContributeAmount((prev) => ({ ...prev, [pool.id]: e.target.value }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busyId === pool.id || !contributeAmount[pool.id]}
                    onClick={() => handleContribute(pool.id)}
                  >
                    {busyId === pool.id ? "..." : "Chip in"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Input
            placeholder="Pool title (e.g. Dad's new grill)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
          <div className="relative shrink-0 w-full sm:w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="Target"
              className="pl-6"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !title.trim() || !target} className="shrink-0">
            {creating ? "Creating..." : "New Pool"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
