import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProfilePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const user = session.user;

  return (
    <div className="container max-w-lg mx-auto py-6 px-4 sm:px-6 sm:py-8 md:px-8">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.avatarUrl && (
            <Image
              src={user.avatarUrl}
              alt="Avatar"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full"
            />
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Name</p>
            <p className="text-foreground">{user?.name || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="text-foreground">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Subscription
            </p>
            <div className="flex items-center gap-2">
              <p className="text-foreground capitalize">
                {user?.subscriptionTier || "free"}
              </p>
              {(user?.subscriptionTier || "free") === "free" ? (
                <Link
                  href="/upgrade"
                  className="inline-flex items-center justify-center rounded-lg h-7 px-2.5 text-[0.8rem] font-medium border border-amber text-amber hover:bg-muted transition-colors"
                >
                  Upgrade
                </Link>
              ) : (
                <Link
                  href="/billing"
                  className="inline-flex items-center justify-center rounded-lg h-7 px-2.5 text-[0.8rem] font-medium border border-border hover:bg-muted transition-colors"
                >
                  Manage
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
