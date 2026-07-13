export default function FamilyInviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-8">
      <div className="aurora-wash" aria-hidden="true">
        <div className="b1" />
        <div className="b2" />
        <div className="b3" />
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
