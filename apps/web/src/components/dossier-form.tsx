"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RELATIONSHIP_TYPES, ALLERGEN_OPTIONS, DIETARY_OPTIONS, PRONOUN_OPTIONS } from "@broflo/shared";
import type { Person, CreatePersonData } from "@broflo/shared";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  pronouns: z.string().optional(),
  customPronouns: z.string().optional(),
  birthday: z.string().optional(),
  anniversary: z.string().optional(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  clothingSizeTop: z.string().optional(),
  clothingSizeBottom: z.string().optional(),
  shoeSize: z.string().optional(),
  musicTaste: z.string().optional(),
  favoriteBrands: z.string().optional(),
  hobbies: z.string().optional(),
  foodPreferences: z.string().optional(),
  allergens: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  wishlistUrls: z.string().optional(),
  notes: z.string().optional(),
  shippingAddress1: z.string().optional(),
  shippingAddress2: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().max(2).optional(),
  shippingZip: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid zip code").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

function toDateInputValue(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return new Date(val).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

interface DossierFormProps {
  defaultValues?: Person;
  onSubmit: (data: CreatePersonData) => Promise<void>;
  submitLabel?: string;
}

export function DossierForm({
  defaultValues,
  onSubmit,
  submitLabel = "Add Person",
}: DossierFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues
      ? {
          name: defaultValues.name,
          relationship: defaultValues.relationship,
          pronouns: defaultValues.pronouns && !PRONOUN_OPTIONS.includes(defaultValues.pronouns as typeof PRONOUN_OPTIONS[number])
            ? "custom"
            : (defaultValues.pronouns ?? ""),
          customPronouns: defaultValues.pronouns && !PRONOUN_OPTIONS.includes(defaultValues.pronouns as typeof PRONOUN_OPTIONS[number])
            ? defaultValues.pronouns
            : "",
          birthday: toDateInputValue(defaultValues.birthday),
          anniversary: toDateInputValue(defaultValues.anniversary),
          budgetMin: defaultValues.budgetMinCents
            ? defaultValues.budgetMinCents / 100
            : undefined,
          budgetMax: defaultValues.budgetMaxCents
            ? defaultValues.budgetMaxCents / 100
            : undefined,
          clothingSizeTop: defaultValues.clothingSizeTop ?? "",
          clothingSizeBottom: defaultValues.clothingSizeBottom ?? "",
          shoeSize: defaultValues.shoeSize ?? "",
          musicTaste: defaultValues.musicTaste ?? "",
          favoriteBrands: defaultValues.favoriteBrands ?? "",
          hobbies: defaultValues.hobbies ?? "",
          foodPreferences: defaultValues.foodPreferences ?? "",
          allergens: defaultValues.allergens ?? [],
          dietaryRestrictions: defaultValues.dietaryRestrictions ?? [],
          wishlistUrls: defaultValues.wishlistUrls ?? "",
          notes: defaultValues.notes ?? "",
          shippingAddress1: defaultValues.shippingAddress1 ?? "",
          shippingAddress2: defaultValues.shippingAddress2 ?? "",
          shippingCity: defaultValues.shippingCity ?? "",
          shippingState: defaultValues.shippingState ?? "",
          shippingZip: defaultValues.shippingZip ?? "",
        }
      : { name: "", relationship: "", allergens: [], dietaryRestrictions: [] },
  });

  const relationship = watch("relationship");

  const pronouns = watch("pronouns");

  async function onFormSubmit(values: FormValues) {
    const resolvedPronouns = values.pronouns === "custom"
      ? (values.customPronouns || undefined)
      : (values.pronouns || undefined);

    await onSubmit({
      name: values.name,
      relationship: values.relationship,
      pronouns: resolvedPronouns,
      birthday: values.birthday || undefined,
      anniversary: values.anniversary || undefined,
      budgetMinCents: values.budgetMin ? Math.round(values.budgetMin * 100) : undefined,
      budgetMaxCents: values.budgetMax ? Math.round(values.budgetMax * 100) : undefined,
      clothingSizeTop: values.clothingSizeTop || undefined,
      clothingSizeBottom: values.clothingSizeBottom || undefined,
      shoeSize: values.shoeSize || undefined,
      musicTaste: values.musicTaste || undefined,
      favoriteBrands: values.favoriteBrands || undefined,
      hobbies: values.hobbies || undefined,
      foodPreferences: values.foodPreferences || undefined,
      allergens: values.allergens?.length ? values.allergens : undefined,
      dietaryRestrictions: values.dietaryRestrictions?.length ? values.dietaryRestrictions : undefined,
      wishlistUrls: values.wishlistUrls || undefined,
      notes: values.notes || undefined,
      shippingAddress1: values.shippingAddress1 || undefined,
      shippingAddress2: values.shippingAddress2 || undefined,
      shippingCity: values.shippingCity || undefined,
      shippingState: values.shippingState || undefined,
      shippingZip: values.shippingZip || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="prefs">Preferences</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register("name")} placeholder="Who are they?" />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Select
                  value={relationship}
                  onValueChange={(v: string | null) => setValue("relationship", v ?? "", { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="How do you know them?" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.relationship && (
                  <p className="text-sm text-destructive mt-1">{errors.relationship.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="pronouns">Pronouns</Label>
                <Select
                  value={pronouns ?? ""}
                  onValueChange={(v: string | null) => setValue("pronouns", v ?? "", { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="How should we refer to them?" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRONOUN_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {pronouns === "custom" && (
                  <Input
                    className="mt-2"
                    placeholder="Enter pronouns"
                    {...register("customPronouns")}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="birthday">Birthday</Label>
                  <Input id="birthday" type="date" {...register("birthday")} />
                </div>
                <div>
                  <Label htmlFor="anniversary">Anniversary</Label>
                  <Input id="anniversary" type="date" {...register("anniversary")} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm text-muted-foreground">
                Set a budget range for gifts. We&apos;ll stay in bounds.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="budgetMin">Min ($)</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    min={0}
                    placeholder="25"
                    {...register("budgetMin", { valueAsNumber: true })}
                  />
                </div>
                <div>
                  <Label htmlFor="budgetMax">Max ($)</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    min={0}
                    placeholder="150"
                    {...register("budgetMax", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prefs">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="clothingSizeTop">Top Size</Label>
                  <Input id="clothingSizeTop" placeholder="M" {...register("clothingSizeTop")} />
                </div>
                <div>
                  <Label htmlFor="clothingSizeBottom">Bottom Size</Label>
                  <Input id="clothingSizeBottom" placeholder="32" {...register("clothingSizeBottom")} />
                </div>
                <div>
                  <Label htmlFor="shoeSize">Shoe Size</Label>
                  <Input id="shoeSize" placeholder="10" {...register("shoeSize")} />
                </div>
              </div>

              <div>
                <Label htmlFor="musicTaste">Music Taste</Label>
                <Input id="musicTaste" placeholder="Indie, jazz, lo-fi..." {...register("musicTaste")} />
              </div>

              <div>
                <Label htmlFor="favoriteBrands">Favorite Brands</Label>
                <Input id="favoriteBrands" placeholder="Nike, Patagonia..." {...register("favoriteBrands")} />
              </div>

              <div>
                <Label htmlFor="hobbies">Hobbies</Label>
                <Input id="hobbies" placeholder="Hiking, cooking, gaming..." {...register("hobbies")} />
              </div>

              <div>
                <Label htmlFor="foodPreferences">Food Preferences</Label>
                <Input id="foodPreferences" placeholder="Thai, sushi, vegetarian..." {...register("foodPreferences")} />
              </div>

              <div>
                <Label>Allergens</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Used only to filter gift suggestions. Not medical advice.
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map((allergen) => {
                    const selected = (watch("allergens") ?? []).includes(allergen);
                    return (
                      <button
                        key={allergen}
                        type="button"
                        aria-pressed={selected}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary/50"
                        }`}
                        onClick={() => {
                          const current = watch("allergens") ?? [];
                          setValue(
                            "allergens",
                            selected ? current.filter((a) => a !== allergen) : [...current, allergen],
                          );
                        }}
                      >
                        {selected && <span className="mr-1">&#10003;</span>}
                        <span className="capitalize">{allergen}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Dietary Restrictions</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DIETARY_OPTIONS.map((diet) => {
                    const selected = (watch("dietaryRestrictions") ?? []).includes(diet);
                    return (
                      <button
                        key={diet}
                        type="button"
                        aria-pressed={selected}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary/50"
                        }`}
                        onClick={() => {
                          const current = watch("dietaryRestrictions") ?? [];
                          setValue(
                            "dietaryRestrictions",
                            selected ? current.filter((d) => d !== diet) : [...current, diet],
                          );
                        }}
                      >
                        {selected && <span className="mr-1">&#10003;</span>}
                        <span className="capitalize">{diet}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="wishlistUrls">Wishlist URLs</Label>
                <Textarea
                  id="wishlistUrls"
                  placeholder="Paste Amazon, Etsy, or any wishlist links — one per line"
                  rows={3}
                  {...register("wishlistUrls")}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Anything else we should know about them..."
                  rows={4}
                  {...register("notes")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="shipping">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm text-muted-foreground">
                Where should gifts for this person be shipped?
              </p>
              <div>
                <Label htmlFor="shippingAddress1">Address Line 1</Label>
                <Input
                  id="shippingAddress1"
                  placeholder="123 Main St"
                  autoComplete="address-line1"
                  {...register("shippingAddress1")}
                />
              </div>
              <div>
                <Label htmlFor="shippingAddress2">Address Line 2</Label>
                <Input
                  id="shippingAddress2"
                  placeholder="Apt 4B"
                  autoComplete="address-line2"
                  {...register("shippingAddress2")}
                />
              </div>
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-3">
                  <Label htmlFor="shippingCity">City</Label>
                  <Input
                    id="shippingCity"
                    placeholder="Portland"
                    autoComplete="address-level2"
                    {...register("shippingCity")}
                  />
                </div>
                <div className="col-span-1">
                  <Label htmlFor="shippingState">State</Label>
                  <Input
                    id="shippingState"
                    placeholder="OR"
                    maxLength={2}
                    autoComplete="address-level1"
                    {...register("shippingState")}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="shippingZip">Zip</Label>
                  <Input
                    id="shippingZip"
                    placeholder="97201"
                    autoComplete="postal-code"
                    {...register("shippingZip")}
                  />
                  {errors.shippingZip && (
                    <p className="text-sm text-destructive mt-1">{errors.shippingZip.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
