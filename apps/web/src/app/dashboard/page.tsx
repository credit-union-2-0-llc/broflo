import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            Welcome, {session.user?.name || "friend"}.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">
            {session.user?.email}
          </p>
          <p className="text-sm text-muted-foreground">
            Tier: {session.user?.subscriptionTier || "free"} | Score:{" "}
            {session.user?.brofloScore || 0}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
