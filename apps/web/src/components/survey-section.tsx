"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api";
import type { SurveyResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { tierAtLeast } from "@broflo/shared";
import { toast } from "sonner";

const FIELD_LABELS: Record<string, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  clothingSizeTop: "Top size",
  clothingSizeBottom: "Bottom size",
  shoeSize: "Shoe size",
  musicTaste: "Music taste",
  favoriteBrands: "Favorite brands",
  hobbies: "Hobbies",
  foodPreferences: "Food preferences",
  wishlistUrls: "Wishlist links",
  notes: "Notes",
  pronouns: "Pronouns",
  allergens: "Allergens",
  dietaryRestrictions: "Dietary restrictions",
};

function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

const SURVEY_QUESTION_KEYS = Object.keys(FIELD_LABELS);

interface SurveySectionProps {
  personId: string;
  personName: string;
  recipientEmail: string | null;
  tier: string;
}

export function SurveySection({ personId, personName, recipientEmail, tier }: SurveySectionProps) {
  const { data: session } = useSession();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState(recipientEmail ?? "");
  const [questionsToSend, setQuestionsToSend] = useState<Set<string>>(new Set(SURVEY_QUESTION_KEYS));
  const [sending, setSending] = useState(false);
  const [sendUpgradeMessage, setSendUpgradeMessage] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const [selectedFields, setSelectedFields] = useState<Record<string, Set<string>>>({});

  const canSendSurvey = tierAtLeast(tier, "pro");

  function toggleQuestion(field: string) {
    setQuestionsToSend((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  useEffect(() => {
    if (!session?.accessToken) return;
    api
      .getSurveyResponses(session.accessToken, personId)
      .then((res) => {
        setResponses(res);
        const initialSelection: Record<string, Set<string>> = {};
        for (const r of res) initialSelection[r.id] = new Set(Object.keys(r.answers));
        setSelectedFields(initialSelection);
      })
      .catch(() => {})
      .finally(() => setLoadingResponses(false));
  }, [session?.accessToken, personId]);

  async function handleSend() {
    if (!session?.accessToken) return;
    setSending(true);
    setSendUpgradeMessage(null);
    try {
      await api.sendSurvey(
        session.accessToken,
        personId,
        emailInput.trim() || undefined,
        Array.from(questionsToSend),
      );
      toast.success(`Survey sent to ${personName}.`);
      setSendDialogOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setSendUpgradeMessage(err.message);
      } else {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to send survey. Try again.",
        );
      }
    } finally {
      setSending(false);
    }
  }

  function toggleField(responseId: string, field: string) {
    setSelectedFields((prev) => {
      const current = new Set(prev[responseId]);
      if (current.has(field)) current.delete(field);
      else current.add(field);
      return { ...prev, [responseId]: current };
    });
  }

  async function handleReview(responseId: string, action: "accept" | "dismiss") {
    if (!session?.accessToken) return;
    setReviewing((prev) => ({ ...prev, [responseId]: true }));
    try {
      const fields = action === "accept" ? Array.from(selectedFields[responseId] ?? []) : undefined;
      await api.reviewSurveyResponse(session.accessToken, personId, responseId, { action, fields });
      setResponses((prev) => prev.filter((r) => r.id !== responseId));
      toast.success(action === "accept" ? "Applied to their profile." : "Dismissed.");
    } catch {
      toast.error("Failed to save. Try again.");
    } finally {
      setReviewing((prev) => ({ ...prev, [responseId]: false }));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Recipient Survey</h3>
        <Button variant="outline" size="sm" onClick={() => setSendDialogOpen(true)}>
          Send a Survey
        </Button>
      </div>

      {!loadingResponses && responses.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Not sure what {personName} likes? Send them a short survey to fill in the gaps.
        </p>
      )}

      {responses.map((response) => (
        <Card key={response.id} className="border-amber-3 bg-amber-glow mb-2">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">{personName} filled out their survey — review before applying:</p>
            <div className="space-y-2">
              {Object.entries(response.answers).map(([field, value]) => (
                <label key={field} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedFields[response.id]?.has(field) ?? true}
                    onChange={() => toggleField(response.id, field)}
                  />
                  <span>
                    <span className="text-muted-foreground">{FIELD_LABELS[field] ?? field}:</span>{" "}
                    <span className="font-medium">{formatAnswer(value)}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={reviewing[response.id]}
                onClick={() => handleReview(response.id, "dismiss")}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                disabled={reviewing[response.id] || (selectedFields[response.id]?.size ?? 0) === 0}
                onClick={() => handleReview(response.id, "accept")}
              >
                {reviewing[response.id] ? "Applying..." : "Apply selected"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send a Survey to {personName}</DialogTitle>
          </DialogHeader>
          {!canSendSurvey ? (
            <div className="space-y-4">
              <UpgradePrompt message="Recipient surveys are a Pro feature. Upgrade to let people fill in their own details." />
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setSendDialogOpen(false)}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We&apos;ll email them a short, friendly form to fill in their own sizes and preferences. Nothing changes on their profile until you review and approve it.
              </p>
              {sendUpgradeMessage && <UpgradePrompt message={sendUpgradeMessage} />}
              <div>
                <Label htmlFor="recipientEmail">Their email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="them@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Which questions?</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() =>
                      setQuestionsToSend((prev) =>
                        prev.size === SURVEY_QUESTION_KEYS.length ? new Set() : new Set(SURVEY_QUESTION_KEYS),
                      )
                    }
                  >
                    {questionsToSend.size === SURVEY_QUESTION_KEYS.length ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SURVEY_QUESTION_KEYS.map((field) => (
                    <label key={field} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={questionsToSend.has(field)}
                        onChange={() => toggleQuestion(field)}
                      />
                      {FIELD_LABELS[field]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSend} disabled={sending || !emailInput.trim() || questionsToSend.size === 0}>
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
