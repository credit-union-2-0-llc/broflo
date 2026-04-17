"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { AutopilotRule, AutopilotRun } from "@/lib/api";
import type { Person } from "@broflo/shared";

const OCCASION_TYPES = [
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "holiday", label: "Holiday" },
  { value: "graduation", label: "Graduation" },
  { value: "promotion", label: "Promotion" },
  { value: "custom", label: "Custom" },
];

const RUN_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  triggered: { label: "Triggered", variant: "secondary" },
  order_placed: { label: "Ordered", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  skipped_budget: { label: "Over Budget", variant: "outline" },
  skipped_confidence: { label: "Needs Review", variant: "outline" },
  skipped_tier: { label: "Tier Issue", variant: "destructive" },
  skipped_no_suggestion: { label: "No Match", variant: "outline" },
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function AutopilotPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [rules, setRules] = useState<AutopilotRule[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Tier gate
  const tier = session?.user?.subscriptionTier ?? "free";
  const hasAccess = tier === "pro" || tier === "elite";

  const loadData = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const [rulesRes, personsRes, spendRes] = await Promise.all([
        api.listRules(session.accessToken),
        api.listPersons(session.accessToken),
        api.getAutopilotSpend(session.accessToken),
      ]);
      setRules(rulesRes);
      setPersons(personsRes);
      setMonthlySpent(spendRes.monthlySpentCents);
    } catch {
      // Will show empty state
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.push("/login");
  }, [sessionStatus, router]);

  useEffect(() => {
    if (hasAccess) loadData();
    else setLoading(false);
  }, [hasAccess, loadData]);

  async function toggleRule(rule: AutopilotRule) {
    if (!session?.accessToken) return;
    try {
      const updated = await api.updateRule(session.accessToken, rule.id, {
        isActive: !rule.isActive,
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      toast.success(updated.isActive ? VOICE.autopilot.enabled : VOICE.autopilot.disabled);
    } catch {
      toast.error(VOICE.errors.generic);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!session?.accessToken) return;
    try {
      await api.deleteRule(session.accessToken, ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast.success("Rule deleted.");
    } catch {
      toast.error(VOICE.errors.generic);
    }
  }

  // Tier gate screen
  if (!hasAccess && !loading) {
    return (
      <div className="bg-transparent px-4 py-6 sm:px-6 sm:py-8 md:px-8">
        <div className="mx-auto max-w-2xl text-center py-20">
          <Zap className="h-12 w-12 text-amber mx-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Autopilot</h1>
          <p className="text-muted-foreground mb-6 italic">
            {VOICE.autopilot.tierGate}
          </p>
          <Button onClick={() => router.push("/upgrade")} size="lg">
            <Sparkles className="h-4 w-4 mr-2" />
            {VOICE.billing.upgradeCta}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-amber" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Autopilot</h1>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </DialogTrigger>
            <CreateRuleDialog
              token={session?.accessToken ?? ""}
              persons={persons}
              existingPersonIds={rules.map((r) => r.personId)}
              onCreated={(rule) => {
                setRules((prev) => [rule, ...prev]);
                setShowCreate(false);
                toast.success(VOICE.autopilot.enabled);
              }}
            />
          </Dialog>
        </div>

        {/* Monthly spend summary */}
        {rules.length > 0 && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Monthly Autopilot Spend</span>
                <span className="text-sm text-muted-foreground">
                  {formatCents(monthlySpent)} this month
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rules list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground italic">
                {VOICE.autopilot.emptyState}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                expanded={expandedRule === rule.id}
                onToggleExpand={() =>
                  setExpandedRule((prev) => (prev === rule.id ? null : rule.id))
                }
                onToggleActive={() => toggleRule(rule)}
                onDelete={() => deleteRule(rule.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  expanded,
  onToggleExpand,
  onToggleActive,
  onDelete,
}: {
  rule: AutopilotRule;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const runs = rule.runs ?? [];
  const totalCap = rule.monthlyCapCents;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onToggleActive}
              className={`shrink-0 h-5 w-9 rounded-full transition-colors relative ${
                rule.isActive ? "bg-amber" : "bg-muted"
              }`}
              aria-label={rule.isActive ? "Disable rule" : "Enable rule"}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  rule.isActive ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{rule.person.name}</p>
              <p className="text-xs text-muted-foreground">
                {rule.occasionTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}
                {" · "}
                {formatCents(rule.budgetMinCents)}–{formatCents(rule.budgetMaxCents)} per gift
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={rule.isActive ? "default" : "secondary"}>
              {rule.isActive ? "Active" : "Paused"}
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0" />}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete autopilot rule?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the autopilot rule for {rule.person.name}.
                    No more automatic orders will be placed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onToggleExpand}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Spend progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Monthly cap: {formatCents(totalCap)}/mo</span>
            <span>Lead: {rule.leadDays} days</span>
          </div>
        </div>

        {/* Expanded: recent runs */}
        {expanded && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Recent Runs</p>
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No runs yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run: AutopilotRun) => {
                  const meta = RUN_STATUS_LABELS[run.status] ?? {
                    label: run.status,
                    variant: "outline" as const,
                  };
                  return (
                    <div
                      key={run.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.variant} className="text-[10px]">
                          {meta.label}
                        </Badge>
                        <span className="text-muted-foreground">
                          {run.event?.name ?? "Event"} ({run.event?.occasionType ?? ""})
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(run.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateRuleDialog({
  token,
  persons,
  existingPersonIds,
  onCreated,
}: {
  token: string;
  persons: Person[];
  existingPersonIds: string[];
  onCreated: (rule: AutopilotRule) => void;
}) {
  const availablePersons = persons.filter((p) => !existingPersonIds.includes(p.id));

  const [personId, setPersonId] = useState("");
  const [occasionTypes, setOccasionTypes] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState(20);
  const [budgetMax, setBudgetMax] = useState(75);
  const [monthlyCap, setMonthlyCap] = useState(150);
  const [leadDays, setLeadDays] = useState(7);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleOccasion(value: string) {
    setOccasionTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personId || occasionTypes.length === 0 || !consent) return;
    setSubmitting(true);
    try {
      const rule = await api.createRule(token, {
        personId,
        occasionTypes,
        budgetMinCents: budgetMin * 100,
        budgetMaxCents: budgetMax * 100,
        monthlyCapCents: monthlyCap * 100,
        leadDays,
        consentGiven: true,
      });
      onCreated(rule);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : VOICE.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New Autopilot Rule</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        {/* Person selector */}
        <div className="space-y-2">
          <Label>Person</Label>
          {availablePersons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All your people already have autopilot rules.
            </p>
          ) : (
            <Select value={personId} onValueChange={(v) => setPersonId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {availablePersons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Occasion types multi-select */}
        <div className="space-y-2">
          <Label>Occasions</Label>
          <div className="flex flex-wrap gap-2">
            {OCCASION_TYPES.map((ot) => (
              <button
                key={ot.value}
                type="button"
                onClick={() => toggleOccasion(ot.value)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  occasionTypes.includes(ot.value)
                    ? "bg-amber text-white border-amber"
                    : "bg-background border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {ot.label}
              </button>
            ))}
          </div>
        </div>

        {/* Budget range */}
        <div className="space-y-2">
          <Label>Gift Budget Range</Label>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Min: ${budgetMin}</span>
                <span>Max: ${budgetMax}</span>
              </div>
              <Slider
                min={5}
                max={500}
                value={[budgetMin, budgetMax]}
                onValueChange={(val) => {
                  const vals = Array.isArray(val) ? val : [val];
                  setBudgetMin(vals[0]);
                  setBudgetMax(vals[1] ?? vals[0]);
                }}
              />
            </div>
          </div>
        </div>

        {/* Monthly cap */}
        <div className="space-y-2">
          <Label>Monthly Spending Cap</Label>
          <div className="flex items-center gap-3">
            <span className="text-sm">$</span>
            <Input
              type="number"
              min={5}
              max={2000}
              value={monthlyCap}
              onChange={(e) => setMonthlyCap(Number(e.target.value))}
              className="w-28"
            />
            <span className="text-xs text-muted-foreground">/month (max $2,000)</span>
          </div>
        </div>

        {/* Lead days */}
        <div className="space-y-2">
          <Label>Lead Time</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={30}
              value={leadDays}
              onChange={(e) => setLeadDays(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">days before the event</span>
          </div>
        </div>

        {/* Consent checkbox */}
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
          <input
            type="checkbox"
            id="autopilot-consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-amber"
          />
          <label htmlFor="autopilot-consent" className="text-sm leading-snug">
            {VOICE.autopilot.consentLabel(formatCents(monthlyCap * 100))}
          </label>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={!personId || occasionTypes.length === 0 || !consent || submitting}
        >
          {submitting ? "Creating..." : "Enable Autopilot"}
        </Button>
      </form>
    </DialogContent>
  );
}
