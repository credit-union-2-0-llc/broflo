"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DossierForm } from "@/components/dossier-form";
import { api } from "@/lib/api";
import type { Person, CreatePersonData } from "@broflo/shared";
import { toast } from "sonner";

export default function EditPersonPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.accessToken || !params.id) return;
    api
      .getPerson(session.accessToken, params.id as string)
      .then(setPerson)
      .catch(() => {
        toast.error("Person not found");
        router.push("/people");
      })
      .finally(() => setLoading(false));
  }, [session, params.id, router]);

  async function handleSubmit(data: CreatePersonData) {
    if (!session?.accessToken || !params.id) return;
    try {
      await api.updatePerson(session.accessToken, params.id as string, data);
      toast.success("Updated.");
      router.push(`/people/${params.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
          Edit {person?.name || "Person"}
        </h1>
        {person && <DossierForm defaultValues={person} onSubmit={handleSubmit} submitLabel="Save Changes" />}
      </div>
    </div>
  );
}
