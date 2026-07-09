"use client";

import { useState } from "react";
import { ALLERGEN_OPTIONS, DIETARY_OPTIONS, PRONOUN_OPTIONS } from "@broflo/shared";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SurveyFormClientProps {
  token: string;
  personFirstName: string;
  fields: string[];
}

// Deliberately narrower than the full backend-allowed field set — asking a
// recipient to suggest their own gift budget felt presumptuous for a "tell
// us about yourself" survey, so budgetMinCents/budgetMaxCents are supported
// by the API but just never rendered here.
type AnswerValue = string | string[] | undefined;

export function SurveyFormClient({ token, personFirstName, fields }: SurveyFormClientProps) {
  const has = (key: string) => fields.includes(key);

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPronouns, setCustomPronouns] = useState("");

  function setField(key: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function toggleListValue(key: string, value: string) {
    const current = (answers[key] as string[] | undefined) ?? [];
    setField(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(answers)) {
      if (key === "pronouns" && value === "custom") {
        if (customPronouns.trim()) payload.pronouns = customPronouns.trim();
        continue;
      }
      if (Array.isArray(value)) {
        if (value.length > 0) payload[key] = value;
      } else if (value && value.trim()) {
        payload[key] = value.trim();
      }
    }

    try {
      await api.submitSurvey(token, payload);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 410
          ? "This survey was already submitted — thanks again for filling it out!"
          : "Something went wrong submitting this. Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">broflo.</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-center">
            Thanks, {personFirstName}! Your answers are on their way — you can close this tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold">broflo.</CardTitle>
        <CardDescription>
          Someone&apos;s putting together something great for you, {personFirstName}. A couple minutes here helps them get it right — everything&apos;s optional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          {has("pronouns") && (
            <div>
              <Label htmlFor="pronouns">Pronouns</Label>
              <Select
                value={(answers.pronouns as string) ?? ""}
                onValueChange={(v) => setField("pronouns", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {PRONOUN_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {answers.pronouns === "custom" && (
                <Input
                  className="mt-2"
                  placeholder="Enter pronouns"
                  value={customPronouns}
                  onChange={(e) => setCustomPronouns(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {has("birthday") && (
              <div>
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={(answers.birthday as string) ?? ""}
                  onChange={(e) => setField("birthday", e.target.value)}
                />
              </div>
            )}
            {has("anniversary") && (
              <div>
                <Label htmlFor="anniversary">Anniversary</Label>
                <Input
                  id="anniversary"
                  type="date"
                  value={(answers.anniversary as string) ?? ""}
                  onChange={(e) => setField("anniversary", e.target.value)}
                />
              </div>
            )}
          </div>

          {(has("clothingSizeTop") || has("clothingSizeBottom") || has("shoeSize")) && (
            <div className="grid grid-cols-3 gap-4">
              {has("clothingSizeTop") && (
                <div>
                  <Label htmlFor="clothingSizeTop">Top Size</Label>
                  <Input id="clothingSizeTop" placeholder="M" value={(answers.clothingSizeTop as string) ?? ""} onChange={(e) => setField("clothingSizeTop", e.target.value)} />
                </div>
              )}
              {has("clothingSizeBottom") && (
                <div>
                  <Label htmlFor="clothingSizeBottom">Bottom Size</Label>
                  <Input id="clothingSizeBottom" placeholder="32" value={(answers.clothingSizeBottom as string) ?? ""} onChange={(e) => setField("clothingSizeBottom", e.target.value)} />
                </div>
              )}
              {has("shoeSize") && (
                <div>
                  <Label htmlFor="shoeSize">Shoe Size</Label>
                  <Input id="shoeSize" placeholder="10" value={(answers.shoeSize as string) ?? ""} onChange={(e) => setField("shoeSize", e.target.value)} />
                </div>
              )}
            </div>
          )}

          {has("musicTaste") && (
            <div>
              <Label htmlFor="musicTaste">Music Taste</Label>
              <Input id="musicTaste" placeholder="Indie, jazz, lo-fi..." value={(answers.musicTaste as string) ?? ""} onChange={(e) => setField("musicTaste", e.target.value)} />
            </div>
          )}

          {has("favoriteBrands") && (
            <div>
              <Label htmlFor="favoriteBrands">Favorite Brands</Label>
              <Input id="favoriteBrands" placeholder="Nike, Patagonia..." value={(answers.favoriteBrands as string) ?? ""} onChange={(e) => setField("favoriteBrands", e.target.value)} />
            </div>
          )}

          {has("hobbies") && (
            <div>
              <Label htmlFor="hobbies">Hobbies</Label>
              <Input id="hobbies" placeholder="Hiking, cooking, gaming..." value={(answers.hobbies as string) ?? ""} onChange={(e) => setField("hobbies", e.target.value)} />
            </div>
          )}

          {has("foodPreferences") && (
            <div>
              <Label htmlFor="foodPreferences">Food Preferences</Label>
              <Input id="foodPreferences" placeholder="Thai, sushi, vegetarian..." value={(answers.foodPreferences as string) ?? ""} onChange={(e) => setField("foodPreferences", e.target.value)} />
            </div>
          )}

          {has("allergens") && (
            <div>
              <Label>Allergens</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALLERGEN_OPTIONS.map((allergen) => {
                  const selected = ((answers.allergens as string[]) ?? []).includes(allergen);
                  return (
                    <button
                      key={allergen}
                      type="button"
                      aria-pressed={selected}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-amber-3"
                      }`}
                      onClick={() => toggleListValue("allergens", allergen)}
                    >
                      {selected && <span className="mr-1">&#10003;</span>}
                      <span className="capitalize">{allergen}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {has("dietaryRestrictions") && (
            <div>
              <Label>Dietary Restrictions</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DIETARY_OPTIONS.map((diet) => {
                  const selected = ((answers.dietaryRestrictions as string[]) ?? []).includes(diet);
                  return (
                    <button
                      key={diet}
                      type="button"
                      aria-pressed={selected}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-amber-3"
                      }`}
                      onClick={() => toggleListValue("dietaryRestrictions", diet)}
                    >
                      {selected && <span className="mr-1">&#10003;</span>}
                      <span className="capitalize">{diet}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {has("wishlistUrls") && (
            <div>
              <Label htmlFor="wishlistUrls">Wishlist Links</Label>
              <Textarea
                id="wishlistUrls"
                placeholder="Paste any wishlist links you have — one per line"
                rows={2}
                value={(answers.wishlistUrls as string) ?? ""}
                onChange={(e) => setField("wishlistUrls", e.target.value)}
              />
            </div>
          )}

          {has("notes") && (
            <div>
              <Label htmlFor="notes">Anything else?</Label>
              <Textarea
                id="notes"
                placeholder="Anything else that'd help them pick something great..."
                rows={3}
                value={(answers.notes as string) ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Sending..." : "Send my answers"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
