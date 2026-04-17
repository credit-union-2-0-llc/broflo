"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface GuidedInterviewProps {
  personId: string;
  personName: string;
  token: string;
  onComplete: () => void;
  onSkip: () => void;
}

type InterviewField = "hobbies" | "favoriteBrands" | "musicTaste" | "foodPreferences" | "notes";

export function GuidedInterview({
  personId,
  personName,
  token,
  onComplete,
  onSkip,
}: GuidedInterviewProps) {
  const questions = VOICE.interview.questions;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<InterviewField, string>>({
    hobbies: "",
    favoriteBrands: "",
    musicTaste: "",
    foodPreferences: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const current = questions[step];
  const isLast = step === questions.length - 1;
  const filledCount = Object.values(answers).filter((v) => v.trim()).length;

  async function handleSubmit() {
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers)) {
      if (value.trim()) {
        updates[key] = value.trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      onSkip();
      return;
    }

    setSaving(true);
    try {
      await api.updatePerson(token, personId, updates);
      toast.success(VOICE.interview.thankYou(personName));
      onComplete();
    } catch {
      toast.error(VOICE.errors.generic);
      setSaving(false);
    }
  }

  function handleNext() {
    if (isLast) {
      handleSubmit();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNext();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{VOICE.interview.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {VOICE.interview.subtitle(personName)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Current question */}
        <div className="space-y-2 min-h-[80px]">
          <Label className="text-sm font-medium">{current.label}</Label>
          <Input
            value={answers[current.field]}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [current.field]: e.target.value }))
            }
            onKeyDown={handleKeyDown}
            placeholder={current.placeholder}
            autoFocus
            disabled={saving}
            className="text-sm"
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div>
            {step > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
                disabled={saving}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                disabled={saving}
              >
                {VOICE.interview.skipLabel}
              </Button>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleNext}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : isLast ? (
              <>
                {VOICE.interview.submitLabel}
                {filledCount > 0 && (
                  <span className="text-xs opacity-75">({filledCount})</span>
                )}
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
