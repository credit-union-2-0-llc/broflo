"use client";

import { VOICE } from "@broflo/shared/copy/voice";

interface PhotoConsentModalProps {
  onAccept: () => void;
  onCancel: () => void;
}

export function PhotoConsentModal({ onAccept, onCancel }: PhotoConsentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-lg">
        <h3 className="mb-3 text-lg font-semibold">Before you upload</h3>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {VOICE.photos.consent}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {VOICE.photos.consentButton}
          </button>
        </div>
      </div>
    </div>
  );
}
