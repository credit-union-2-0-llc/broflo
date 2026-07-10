"use client";

import { useEffect, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import type { SecretSantaExchangeSummary } from "@/lib/api";
import { toast } from "sonner";

interface Peer {
  userId: string;
  name: string | null;
  email: string;
}

interface SecretSantaSectionProps {
  token: string;
  myUserId: string;
  peers: Peer[];
}

function dollars(cents: number | null) {
  if (cents === null) return null;
  return `$${(cents / 100).toFixed(0)}`;
}

export function SecretSantaSection({ token, myUserId, peers }: SecretSantaSectionProps) {
  const [exchanges, setExchanges] = useState<SecretSantaExchangeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [excludeSelections, setExcludeSelections] = useState<Record<string, Set<string>>>({});
  const [assignments, setAssignments] = useState<Record<string, { assigned: boolean; recipientName?: string }>>({});

  async function load() {
    try {
      const result = await api.listSecretSantaExchanges(token);
      setExchanges(result);
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

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const budgetCents = budget ? Math.round(parseFloat(budget) * 100) : undefined;
      await api.createSecretSantaExchange(token, name.trim(), budgetCents);
      toast.success("Exchange created.");
      setName("");
      setBudget("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create exchange.");
    } finally {
      setCreating(false);
    }
  }

  function toggleExclude(exchangeId: string, peerId: string) {
    setExcludeSelections((prev) => {
      const current = new Set(prev[exchangeId] ?? []);
      if (current.has(peerId)) current.delete(peerId);
      else current.add(peerId);
      return { ...prev, [exchangeId]: current };
    });
  }

  async function handleJoin(exchangeId: string) {
    setBusyId(exchangeId);
    try {
      const excludeUserIds = Array.from(excludeSelections[exchangeId] ?? []);
      await api.joinSecretSantaExchange(token, exchangeId, excludeUserIds.length > 0 ? excludeUserIds : undefined);
      toast.success("Joined the exchange.");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to join.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAssign(exchangeId: string) {
    setBusyId(exchangeId);
    try {
      await api.runSecretSantaAssignment(token, exchangeId);
      toast.success("Assignments are ready!");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to run assignment.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReveal(exchangeId: string) {
    setBusyId(exchangeId);
    try {
      const result = await api.getMySecretSantaAssignment(token, exchangeId);
      setAssignments((prev) => ({ ...prev, [exchangeId]: result }));
    } catch {
      toast.error("Failed to load your assignment.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Gift className="h-4 w-4" />
          Secret Santa
        </CardTitle>
        <CardDescription>Organize a gift exchange within your family group.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loading && exchanges.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No exchanges yet — start one below.
          </p>
        )}

        {exchanges.map((exchange) => {
          const myExclusions = excludeSelections[exchange.id] ?? new Set<string>();
          const revealed = assignments[exchange.id];
          const isOrganizer = exchange.createdByUserId === myUserId;

          return (
            <div key={exchange.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{exchange.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {exchange.participantCount} joined
                    {exchange.budgetCents ? ` · ${dollars(exchange.budgetCents)} budget` : ""}
                  </p>
                </div>
                <Badge variant={exchange.status === "open" ? "outline" : "default"}>
                  {exchange.status}
                </Badge>
              </div>

              {exchange.status === "open" && !exchange.isParticipant && (
                <div className="space-y-2">
                  {peers.length > 0 && (
                    <div>
                      <Label className="text-xs">Don&apos;t pair me with (optional)</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {peers.map((peer) => (
                          <label key={peer.userId} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={myExclusions.has(peer.userId)}
                              onChange={() => toggleExclude(exchange.id, peer.userId)}
                            />
                            {peer.name || peer.email}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button size="sm" disabled={busyId === exchange.id} onClick={() => handleJoin(exchange.id)}>
                    {busyId === exchange.id ? "Joining..." : "Join"}
                  </Button>
                </div>
              )}

              {exchange.status === "open" && exchange.isParticipant && isOrganizer && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === exchange.id || exchange.participantCount < 3}
                  onClick={() => handleAssign(exchange.id)}
                >
                  {busyId === exchange.id
                    ? "Assigning..."
                    : exchange.participantCount < 3
                      ? "Need 3+ to assign"
                      : "Run Assignment"}
                </Button>
              )}

              {exchange.status === "open" && exchange.isParticipant && !isOrganizer && (
                <p className="text-xs text-muted-foreground italic">
                  Waiting for the organizer to run the assignment.
                </p>
              )}

              {exchange.status === "assigned" && exchange.isParticipant && (
                revealed ? (
                  <p className="text-sm font-medium text-amber flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {revealed.assigned
                      ? `You're getting a gift for ${revealed.recipientName}!`
                      : "No assignment found."}
                  </p>
                ) : (
                  <Button size="sm" disabled={busyId === exchange.id} onClick={() => handleReveal(exchange.id)}>
                    {busyId === exchange.id ? "Loading..." : "Reveal my match"}
                  </Button>
                )
              )}
            </div>
          );
        })}

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Input
            placeholder="Exchange name (e.g. Office Party)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
          <div className="relative shrink-0 w-full sm:w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="Budget"
              className="pl-6"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating || !name.trim()} className="shrink-0">
            {creating ? "Creating..." : "New Exchange"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
