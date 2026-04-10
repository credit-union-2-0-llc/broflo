import { MainNav } from "@/components/main-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MainNav />
      <main className="flex-1 pb-14 md:pb-0">{children}</main>
    </>
  );
}
