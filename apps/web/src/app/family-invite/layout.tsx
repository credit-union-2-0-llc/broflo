export default function FamilyInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
