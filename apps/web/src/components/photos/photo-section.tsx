"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { VOICE } from "@broflo/shared/copy/voice";
import { api } from "@/lib/api";
import { PhotoUploadTrigger } from "./photo-upload-trigger";
import { PhotoCategoryPicker } from "./photo-category-picker";
import { PhotoGallery } from "./photo-gallery";
import { PhotoLightbox } from "./photo-lightbox";
import { PhotoConsentModal } from "./photo-consent-modal";
import { useToast } from "@/components/ui/use-toast";

interface PhotoSectionProps {
  personId: string;
  personName: string;
  tier: string;
}

interface Photo {
  id: string;
  personId: string;
  category: string;
  analysisStatus: string;
  analysisJson: Record<string, unknown> | null;
  thumbUrl: string | null;
  createdAt: string;
}

export function PhotoSection({ personId, personName, tier }: PhotoSectionProps) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken as string;
  const { toast } = useToast();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);

  // Load photos
  const loadPhotos = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getPhotos(token, personId);
      setPhotos(data);
    } catch {
      // Silent fail on load
    } finally {
      setLoading(false);
    }
  }, [token, personId]);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  // Poll for analysis updates every 10s while any photo is pending/processing
  useEffect(() => {
    const hasPending = photos.some(
      (p) => p.analysisStatus === "pending" || p.analysisStatus === "processing",
    );
    if (!hasPending) return;
    const interval = setInterval(loadPhotos, 10000);
    return () => clearInterval(interval);
  }, [photos, loadPhotos]);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (!consentAcknowledged) {
        setPendingFiles(files);
        setShowConsent(true);
        return;
      }
      setPendingFiles(files);
      setShowCategoryPicker(true);
    },
    [consentAcknowledged],
  );

  const handleConsentAccept = useCallback(() => {
    setConsentAcknowledged(true);
    setShowConsent(false);
    setShowCategoryPicker(true);
  }, []);

  const handleUpload = useCallback(
    async (category?: string) => {
      if (!token || pendingFiles.length === 0) return;
      setShowCategoryPicker(false);
      setUploading(true);

      let successCount = 0;
      for (const file of pendingFiles) {
        try {
          await api.uploadPhoto(token, personId, file, category);
          successCount++;
        } catch (err: any) {
          toast({
            title: "Upload failed",
            description: err.message || "Something went wrong.",
            variant: "destructive",
          });
        }
      }

      setPendingFiles([]);
      setUploading(false);
      await loadPhotos();

      if (successCount > 0 && tier !== "free") {
        toast({ description: VOICE.photos.analysisComplete });
      }
    },
    [token, personId, pendingFiles, tier, loadPhotos, toast],
  );

  const handleDelete = useCallback(
    async (photoId: string) => {
      if (!token) return;
      try {
        await api.deletePhoto(token, personId, photoId);
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch {
        toast({ title: "Delete failed", variant: "destructive" });
      }
    },
    [token, personId, toast],
  );

  const handleReanalyze = useCallback(
    async (photoId: string) => {
      if (!token) return;
      try {
        await api.reanalyzePhoto(token, personId, photoId);
        toast({ description: VOICE.photos.reanalyzeQueued });
        await loadPhotos();
      } catch (err: any) {
        toast({
          title: "Re-analysis failed",
          description: err.message || VOICE.photos.analysisFailed,
          variant: "destructive",
        });
      }
    },
    [token, personId, loadPhotos, toast],
  );

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
        {photos.length > 0 && (
          <PhotoUploadTrigger
            onFilesSelected={handleFilesSelected}
            disabled={uploading}
            compact
          />
        )}
      </div>

      {photos.length === 0 ? (
        <PhotoUploadTrigger
          onFilesSelected={handleFilesSelected}
          disabled={uploading}
        />
      ) : (
        <PhotoGallery
          photos={photos}
          tier={tier}
          onPhotoClick={setLightboxPhotoId}
          onDelete={handleDelete}
        />
      )}

      {uploading && (
        <p className="text-center text-sm text-muted-foreground">
          {VOICE.photos.uploading}
        </p>
      )}

      {/* Consent modal */}
      {showConsent && (
        <PhotoConsentModal
          onAccept={handleConsentAccept}
          onCancel={() => { setShowConsent(false); setPendingFiles([]); }}
        />
      )}

      {/* Category picker */}
      {showCategoryPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-lg">
            <PhotoCategoryPicker
              onSelect={(cat) => handleUpload(cat)}
              onSkip={() => handleUpload()}
            />
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhotoId && (
        <PhotoLightbox
          photoId={lightboxPhotoId}
          personId={personId}
          token={token}
          tier={tier}
          photos={photos}
          onClose={() => setLightboxPhotoId(null)}
          onDelete={handleDelete}
          onReanalyze={handleReanalyze}
        />
      )}
    </div>
  );
}
