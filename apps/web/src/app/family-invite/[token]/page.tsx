import { auth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { AcceptInviteClient } from "./accept-invite-client";

export default async function FamilyInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let preview: { familyName: string; inviterFirstName: string } | null = null;
  let errorMessage: string | null = null;

  try {
    preview = await api.getFamilyInvitePreview(token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 410) {
      errorMessage = "This invite is no longer valid — it may have expired or already been used. Ask them to send a new one.";
    } else if (err instanceof ApiError && err.status === 404) {
      errorMessage = "We couldn't find this invite. Double check the link.";
    } else {
      errorMessage = "Something went wrong loading this invite. Try refreshing.";
    }
  }

  if (!preview) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">broflo.</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">{errorMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const session = await auth();

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl font-bold">broflo.</CardTitle>
        <CardDescription>
          {preview.inviterFirstName} added you to {preview.familyName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Join to get full access to plan gifts for the people you care about, plus family
          features like Secret Santa and group gift pooling.
        </p>
        {session?.accessToken ? (
          <AcceptInviteClient token={token} />
        ) : (
          <div className="space-y-2">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-lg h-9 px-4 text-sm font-medium bg-amber hover:bg-amber-light text-white transition-colors"
            >
              Log in to accept
            </Link>
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account? Logging in will create one — then come back to this link to accept.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
