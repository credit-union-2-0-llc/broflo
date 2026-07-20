"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Zap,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
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
import { VOICE, tierAtLeast } from "@broflo/shared";
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
  ready_for_review: { label: "Ready to Buy", variant: "default" },
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
  const [setupPerson, setSetupPerson] = useState<Person | null>(null);

  // Tier gate
  const tier = session?.user?.subscriptionTier ?? "free";
  const hasAccess = tierAtLeast(tier, "pro");

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

  // Turning a person's toggle on: if they already have a (paused) rule,
  // just reactivate it — the consent + budget were already captured.
  // Otherwise open the setup dialog, since a first-time rule legally
  // requires fresh consent and a budget before it can run.
  function handleTogglePerson(person: Person, rule: AutopilotRule | undefined) {
    if (rule) {
      toggleRule(rule);
    } else {
      setSetupPerson(person);
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

  const sortedPeople = [...persons].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="bg-transparent px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Zap className="h-6 w-6 text-amber" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Autopilot</h1>
            <p className="text-sm text-muted-foreground">
              Flip it on for anyone — we&rsquo;ll shop ahead and notify you when a gift&rsquo;s ready to buy.
            </p>
          </div>
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

        {/* People list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : sortedPeople.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground italic">
                Add a person first, then come back to set up autopilot for them.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedPeople.map((person) => {
              const rule = rules.find((r) => r.personId === person.id);
              return (
                <PersonAutopilotRow
                  key={person.id}
                  person={person}
                  rule={rule}
                  expanded={!!rule && expandedRule === rule.id}
                  onToggleExpand={() =>
                    rule &&
                    setExpandedRule((prev) => (prev === rule.id ? null : rule.id))
                  }
                  onToggle={() => handleTogglePerson(person, rule)}
                  onDelete={rule ? () => deleteRule(rule.id) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={!!setupPerson}
        onOpenChange={(open) => {
          if (!open) setSetupPerson(null);
        }}
      >
        {setupPerson && (
          <CreateRuleDialog
            token={session?.accessToken ?? ""}
            person={setupPerson}
            onCreated={(rule) => {
              setRules((prev) => [rule, ...prev]);
              setSetupPerson(null);
              toast.success(VOICE.autopilot.enabled);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function PersonAutopilotRow({
  person,
  rule,
  expanded,
  onToggleExpand,
  onToggle,
  onDelete,
}: {
  person: Person;
  rule: AutopilotRule | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const runs = rule?.runs ?? [];
  const isActive = rule?.isActive ?? false;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onToggle}
              className={`shrink-0 h-5 w-9 rounded-full transition-colors relative ${
                isActive ? "bg-amber" : "bg-muted"
              }`}
              aria-label={isActive ? `Disable autopilot for ${person.name}` : `Enable autopilot for ${person.name}`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{person.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {rule
                  ? `${rule.occasionTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")} · ${formatCents(rule.budgetMinCents)}–${formatCents(rule.budgetMaxCents)} per gift`
                  : "Not set up yet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {rule && (
              <Badge variant={rule.isActive ? "default" : "secondary"}>
                {rule.isActive ? "Active" : "Paused"}
              </Badge>
            )}
            {rule && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Delete autopilot rule for ${person.name}`}
                    />
                  }
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete autopilot rule?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the autopilot rule for {person.name}.
                      We&rsquo;ll stop shopping ahead of their events.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {rule && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onToggleExpand}
                aria-label={expanded ? `Hide recent runs for ${person.name}` : `Show recent runs for ${person.name}`}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {rule && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Monthly cap: {formatCents(rule.monthlyCapCents)}/mo</span>
              <span>Lead: {rule.leadDays} days</span>
            </div>
          </div>
        )}

        {/* Expanded: recent runs */}
        {expanded && rule && (
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
  person,
  onCreated,
}: {
  token: string;
  person: Person;
  onCreated: (rule: AutopilotRule) => void;
}) {
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
    if (occasionTypes.length === 0 || !consent) return;
    setSubmitting(true);
    try {
      const rule = await api.createRule(token, {
        personId: person.id,
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
        <DialogTitle>Set Up Autopilot for {person.name}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
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
          disabled={occasionTypes.length === 0 || !consent || submitting}
        >
          {submitting ? "Creating..." : "Enable Autopilot"}
        </Button>
      </form>
    </DialogContent>
  );
}
