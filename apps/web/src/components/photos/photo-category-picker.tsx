"use client";

import {
  BookOpen, Shirt, Image, Monitor, UtensilsCrossed, Wine,
  Footprints, Watch, Moon, Wrench, Flower2, Gamepad2,
  PawPrint, Thermometer, Car, Hash, Music, ShoppingCart, HelpCircle,
} from "lucide-react";
import { VOICE } from "@broflo/shared/copy/voice";

const CATEGORIES = [
  { value: "bookshelf", label: "Bookshelf", icon: BookOpen },
  { value: "closet", label: "Closet", icon: Shirt },
  { value: "artwork", label: "Artwork", icon: Image },
  { value: "desk", label: "Desk", icon: Monitor },
  { value: "kitchen", label: "Kitchen", icon: UtensilsCrossed },
  { value: "bar_cart", label: "Bar Cart", icon: Wine },
  { value: "shoes", label: "Shoes", icon: Footprints },
  { value: "jewelry", label: "Jewelry", icon: Watch },
  { value: "nightstand", label: "Nightstand", icon: Moon },
  { value: "garage", label: "Garage", icon: Wrench },
  { value: "garden", label: "Garden", icon: Flower2 },
  { value: "gaming_music", label: "Gaming/Music", icon: Gamepad2 },
  { value: "pet_area", label: "Pet Area", icon: PawPrint },
  { value: "fridge", label: "Fridge", icon: Thermometer },
  { value: "car", label: "Car", icon: Car },
  { value: "social_ig_fb", label: "IG/Facebook", icon: Hash },
  { value: "social_spotify", label: "Spotify", icon: Music },
  { value: "social_amazon", label: "Amazon", icon: ShoppingCart },
] as const;

interface PhotoCategoryPickerProps {
  onSelect: (category: string) => void;
  onSkip: () => void;
}

export function PhotoCategoryPicker({ onSelect, onSkip }: PhotoCategoryPickerProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{VOICE.photos.categoryPickerTitle}</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {CATEGORIES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary hover:bg-primary/5"
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onSkip}
        className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        {VOICE.photos.categorySkip}
      </button>
    </div>
  );
}
