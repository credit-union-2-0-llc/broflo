export default function Home() {
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
      </main>
    </div>
  );
}
