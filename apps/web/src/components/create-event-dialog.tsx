"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { VOICE } from "@broflo/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Person } from "@broflo/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus } from "lucide-react";

const OCCASION_TYPES = [
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "holiday", label: "Holiday" },
  { value: "graduation", label: "Graduation" },
  { value: "promotion", label: "Promotion" },
  { value: "custom", label: "Custom" },
] as const;

const AUTO_RECURRING = new Set(["birthday", "anniversary"]);

interface CreateEventDialogProps {
  people: Person[];
  preselectedPersonId?: string;
  trigger?: React.ReactNode;
}

export function CreateEventDialog({
  people,
  preselectedPersonId,
  trigger,
}: CreateEventDialogProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [personId, setPersonId] = useState(preselectedPersonId || "");
  const [occasionType, setOccasionType] = useState("");
  const [eventName, setEventName] = useState("");
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState("annual");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (preselectedPersonId) setPersonId(preselectedPersonId);
  }, [preselectedPersonId]);

  useEffect(() => {
    if (occasionType && occasionType !== "custom") {
      const label = OCCASION_TYPES.find((t) => t.value === occasionType)?.label || "";
      setEventName(label);
    }
    if (AUTO_RECURRING.has(occasionType)) {
      setRecurrence("annual");
    } else if (occasionType) {
      setRecurrence("one_time");
    }
  }, [occasionType]);

  function resetForm() {
    setPersonId(preselectedPersonId || "");
    setOccasionType("");
    setEventName("");
    setDate("");
    setRecurrence("annual");
    setBudgetMin("");
    setBudgetMax("");
    setNotes("");
    setErrors({});
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!personId) e.personId = "Select a person";
    if (!eventName.trim()) e.name = "Event name is required";
    if (!occasionType) e.occasionType = "Select an occasion type";
    if (!date) e.date = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate() || !session) return;

    setSubmitting(true);
    try {
      await api.createEvent(session.accessToken, personId, {
        name: eventName.trim(),
        date,
        occasionType,
        isRecurring: recurrence === "annual",
        recurrenceRule: recurrence,
        budgetMinCents: budgetMin ? Math.round(parseFloat(budgetMin) * 100) : undefined,
        budgetMaxCents: budgetMax ? Math.round(parseFloat(budgetMax) * 100) : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(VOICE.events.created);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      toast.error("Failed to create event. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger render={trigger ? <>{trigger}</> : <Button />}>
        {!trigger && (
          <>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Event
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-labelledby="create-event-title">
        <DialogHeader>
          <DialogTitle id="create-event-title">Create Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-person">Person *</Label>
            <Select value={personId} onValueChange={(v) => setPersonId(v ?? "")}>
              <SelectTrigger id="event-person" aria-required="true">
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.personId && <p className="text-sm text-destructive mt-1">{errors.personId}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-occasion">Occasion Type *</Label>
            <Select value={occasionType} onValueChange={(v) => setOccasionType(v ?? "")}>
              <SelectTrigger id="event-occasion" aria-required="true">
                <SelectValue placeholder="Select occasion" />
              </SelectTrigger>
              <SelectContent>
                {OCCASION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.occasionType && <p className="text-sm text-destructive mt-1">{errors.occasionType}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-name">Event Name *</Label>
            <Input
              id="event-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              maxLength={100}
              aria-required="true"
            />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-date">Date *</Label>
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-required="true"
            />
            {errors.date && <p className="text-sm text-destructive mt-1">{errors.date}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Recurrence</Label>
            <RadioGroup value={recurrence} onValueChange={setRecurrence} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="one_time" id="rec-once" />
                <Label htmlFor="rec-once" className="font-normal">One-time</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="annual" id="rec-annual" />
                <Label htmlFor="rec-annual" className="font-normal">Annual</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>Budget Override (optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                placeholder="Min $"
                min={0}
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max $"
                min={0}
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Uses person&apos;s default if blank</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-notes">Notes (optional)</Label>
            <Textarea
              id="event-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
