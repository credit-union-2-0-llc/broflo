"use client";

import { useState } from "react";
import { Lock, Loader2, CheckCircle2, AlertCircle, Trash2, RotateCw } from "lucide-react";
import { VOICE } from "@broflo/shared/copy/voice";

interface Photo {
  id: string;
  category: string;
  analysisStatus: string;
  analysisJson: Record<string, unknown> | null;
  thumbUrl: string | null;
  createdAt: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  tier: string;
  onPhotoClick: (photoId: string) => void;
  onDelete: (photoId: string) => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />,
  processing: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
  complete: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failed: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  bookshelf: "Bookshelf", closet: "Closet", artwork: "Artwork", desk: "Desk",
  kitchen: "Kitchen", bar_cart: "Bar Cart", shoes: "Shoes", jewelry: "Jewelry",
  nightstand: "Nightstand", garage: "Garage", garden: "Garden",
  gaming_music: "Gaming/Music", pet_area: "Pet Area", fridge: "Fridge", car: "Car",
  social_ig_fb: "IG/FB", social_spotify: "Spotify", social_amazon: "Amazon", other: "Other",
};

export function PhotoGallery({ photos, tier, onPhotoClick, onDelete }: PhotoGalleryProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-muted transition-shadow hover:shadow-md"
          onClick={() => onPhotoClick(photo.id)}
        >
          {/* Thumbnail */}
          <div className="aspect-square">
            {photo.thumbUrl ? (
              <img
                src={photo.thumbUrl}
                alt={CATEGORY_LABELS[photo.category] || "Photo"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Category badge */}
          <div className="absolute left-1.5 top-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
            {CATEGORY_LABELS[photo.category] || "Other"}
          </div>

          {/* Status chip */}
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5 backdrop-blur-sm">
            {tier === "free" ? (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              STATUS_ICONS[photo.analysisStatus] || null
            )}
          </div>

          {/* Delete button (hover) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirmDelete === photo.id) {
                onDelete(photo.id);
                setConfirmDelete(null);
              } else {
                setConfirmDelete(photo.id);
                setTimeout(() => setConfirmDelete(null), 3000);
              }
            }}
            className="absolute bottom-1.5 right-1.5 rounded-full bg-background/80 p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
            title={confirmDelete === photo.id ? "Click again to confirm" : "Delete photo"}
          >
            <Trash2 className={`h-3.5 w-3.5 ${confirmDelete === photo.id ? "text-red-500" : "text-muted-foreground"}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
