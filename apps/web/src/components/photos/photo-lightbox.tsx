"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, RotateCw, Trash2, Lock } from "lucide-react";
import { VOICE } from "@broflo/shared/copy/voice";
import { api } from "@/lib/api";

interface PhotoLightboxProps {
  photoId: string;
  personId: string;
  token: string;
  tier: string;
  photos: Array<{
    id: string;
    category: string;
    analysisStatus: string;
    analysisJson: Record<string, unknown> | null;
  }>;
  onClose: () => void;
  onDelete: (photoId: string) => void;
  onReanalyze: (photoId: string) => void;
}

export function PhotoLightbox({
  photoId,
  personId,
  token,
  tier,
  photos,
  onClose,
  onDelete,
  onReanalyze,
}: PhotoLightboxProps) {
  const [currentId, setCurrentId] = useState(photoId);
  const [imageData, setImageData] = useState<{ id: string; url: string } | null>(null);

  const currentIndex = photos.findIndex((p) => p.id === currentId);
  const current = photos[currentIndex];
  const loading = !imageData || imageData.id !== currentId;

  useEffect(() => {
    api.getPhotoUrl(token, personId, currentId).then((data) => {
      setImageData({ id: currentId, url: data.url });
    });
  }, [currentId, token, personId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) setCurrentId(photos[currentIndex - 1].id);
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1) setCurrentId(photos[currentIndex + 1].id);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, photos, onClose]);

  if (!current) return null;

  const analysis = current.analysisJson as {
    brands?: string[];
    styles?: string[];
    interests?: string[];
    extracted_tags?: string[];
    raw_observations?: string;
    confidence?: number;
  } | null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/90" onClick={onClose}>
      <div className="flex flex-1 flex-col md:flex-row" onClick={(e) => e.stopPropagation()}>
        {/* Image area */}
        <div className="relative flex flex-1 items-center justify-center p-4">
          {/* Close */}
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>

          {/* Nav arrows */}
          {currentIndex > 0 && (
            <button
              onClick={() => setCurrentId(photos[currentIndex - 1].id)}
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              onClick={() => setCurrentId(photos[currentIndex + 1].id)}
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {loading ? (
            <div className="text-white/60">{VOICE.photos.analyzing}</div>
          ) : (
            imageData?.url && (
              <img
                src={imageData?.url}
                alt="Photo"
                className="max-h-[80vh] max-w-full rounded-lg object-contain"
              />
            )
          )}
        </div>

        {/* Analysis panel */}
        <div className="w-full border-t border-white/10 bg-gray-950 p-6 text-white md:w-80 md:border-l md:border-t-0 md:overflow-y-auto">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/60">
            Signals
          </h3>

          {tier === "free" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Lock className="h-8 w-8 text-white/30" />
              <p className="text-sm text-white/50">{VOICE.photos.tierGateAnalysis}</p>
            </div>
          ) : current.analysisStatus === "complete" && analysis ? (
            <div className="space-y-4">
              {analysis.raw_observations && (
                <p className="text-sm text-white/70">{analysis.raw_observations}</p>
              )}
              {analysis.brands && analysis.brands.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-white/50">Brands</h4>
                  <div className="flex flex-wrap gap-1">
                    {analysis.brands.map((b: string) => (
                      <span key={b} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{b}</span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.interests && analysis.interests.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-white/50">Interests</h4>
                  <div className="flex flex-wrap gap-1">
                    {analysis.interests.map((i: string) => (
                      <span key={i} className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">{i}</span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.styles && analysis.styles.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-white/50">Style Cues</h4>
                  <div className="flex flex-wrap gap-1">
                    {analysis.styles.map((s: string) => (
                      <span key={s} className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.extracted_tags && analysis.extracted_tags.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-white/50">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {analysis.extracted_tags.map((t: string) => (
                      <span key={t} className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {typeof analysis.confidence === "number" && (
                <p className="text-xs text-white/40">
                  Confidence: {Math.round(analysis.confidence * 100)}%
                </p>
              )}
            </div>
          ) : current.analysisStatus === "failed" ? (
            <p className="text-sm text-red-400">{VOICE.photos.analysisFailed}</p>
          ) : (
            <p className="text-sm text-white/50">{VOICE.photos.analyzing}</p>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-2">
            {tier === "elite" && current.analysisStatus === "complete" && (
              <button
                onClick={() => onReanalyze(currentId)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
              >
                <RotateCw className="h-3.5 w-3.5" />
                {VOICE.photos.reanalyze}
              </button>
            )}
            <button
              onClick={() => { onDelete(currentId); onClose(); }}
              className="inline-flex items-center gap-1.5 rounded-md border border-red/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
