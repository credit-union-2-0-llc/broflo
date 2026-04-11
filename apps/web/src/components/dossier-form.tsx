"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RELATIONSHIP_TYPES } from "@broflo/shared";
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
  wishlistUrls: z.string().optional(),
  notes: z.string().optional(),
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
          wishlistUrls: defaultValues.wishlistUrls ?? "",
          notes: defaultValues.notes ?? "",
        }
      : { name: "", relationship: "" },
  });

  const relationship = watch("relationship");

  async function onFormSubmit(values: FormValues) {
    await onSubmit({
      name: values.name,
      relationship: values.relationship,
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
      wishlistUrls: values.wishlistUrls || undefined,
      notes: values.notes || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="prefs">Preferences</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
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
      </Tabs>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
