"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface EventDetailActionsProps {
  eventId: string;
  personId: string;
  eventName: string;
}

export function EventDetailActions({
  eventId,
  personId,
  eventName,
}: EventDetailActionsProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!session) return;
    setDeleting(true);
    try {
      await api.deleteEvent(session.accessToken, personId, eventId);
      toast.success(VOICE.events.deleted);
      router.push("/events");
      router.refresh();
    } catch {
      toast.error("Failed to delete event. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" />}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{eventName}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this event and all its reminders.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
