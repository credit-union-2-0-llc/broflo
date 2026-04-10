"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DossierForm } from "@/components/dossier-form";
import { api } from "@/lib/api";
import type { CreatePersonData } from "@broflo/shared";
import { toast } from "sonner";

export default function NewPersonPage() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSubmit(data: CreatePersonData) {
    if (!session?.accessToken) return;
    try {
      await api.createPerson(session.accessToken, data);
      toast.success("Person added.");
      router.push("/people");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create person");
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Add a Person</h1>
        <DossierForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
