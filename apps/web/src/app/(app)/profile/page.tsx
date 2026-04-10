import Image from "next/image";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Profile</CardTitle>
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
            <p className="text-foreground capitalize">
              {user?.subscriptionTier || "free"}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Broflo Score
            </p>
            <p className="text-foreground">{user?.brofloScore || 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
