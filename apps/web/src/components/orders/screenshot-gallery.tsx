"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Screenshot {
  url: string;
  label: string;
}

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScreenshotGallery({
  screenshots,
  initialIndex = 0,
  open,
  onOpenChange,
}: ScreenshotGalleryProps) {
  const [index, setIndex] = useState(initialIndex);
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setIndex(initialIndex);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % screenshots.length);
  }, [screenshots.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + screenshots.length) % screenshots.length);
  }, [screenshots.length]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goNext, goPrev]);

  if (screenshots.length === 0) return null;

  const current = screenshots[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-black/90 border-none p-0">
        <div className="relative flex flex-col items-center p-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 text-white hover:bg-white/20"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>

          <p className="text-sm text-white mb-3">
            Step {index + 1} of {screenshots.length}: {current.label}
          </p>

          <img
            src={current.url}
            alt={`Agent screenshot: ${current.label}`}
            className="max-w-full max-h-[70vh] rounded-lg object-contain"
          />

          {screenshots.length > 1 && (
            <div className="flex items-center gap-4 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={goPrev}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-white/70">
                {index + 1} / {screenshots.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={goNext}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
