import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background">
      <main className="flex flex-col items-center gap-8">
        <h1 className="text-6xl font-bold tracking-tight text-foreground">
          broflo.
        </h1>
        <p className="max-w-md text-center text-lg text-muted-foreground">
          You&apos;re busy. We remembered. She&apos;s impressed. You&apos;re
          welcome.
        </p>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Get started
        </Link>
      </main>
    </div>
  );
}
