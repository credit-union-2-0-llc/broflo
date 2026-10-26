import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="aurora-wash" aria-hidden="true">
        <div className="b1" />
        <div className="b2" />
        <div className="b3" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <footer className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
      </footer>
    </div>
  );
}
