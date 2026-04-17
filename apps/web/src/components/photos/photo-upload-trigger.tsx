"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { VOICE } from "@broflo/shared/copy/voice";

interface PhotoUploadTriggerProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function PhotoUploadTrigger({
  onFilesSelected,
  disabled,
  compact,
}: PhotoUploadTriggerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      onFilesSelected(Array.from(files));
    },
    [onFilesSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          {VOICE.photos.uploadButton}
        </button>
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        isDragging ? "border-primary bg-amber-glow" : "border-border"
      }`}
    >
      <ImagePlus className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{VOICE.photos.emptyState}</p>
      <p className="text-xs text-muted-foreground/70">{VOICE.photos.emptyStateSubtext}</p>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
          {VOICE.photos.cameraButton}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          {VOICE.photos.chooseButton}
        </button>
      </div>
    </div>
  );
}
