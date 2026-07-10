import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurveyFormClient } from "./survey-form-client";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let survey: { personFirstName: string; fields: string[] } | null = null;
  let errorMessage: string | null = null;

  try {
    survey = await api.getPublicSurvey(token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 410) {
      // Backend already distinguishes "already completed" from "expired" —
      // use its specific message instead of a generic catch-all so someone
      // who never submitted anything isn't told their non-existent
      // submission was received.
      errorMessage = `${err.message} — if you think this is wrong, ask them to send you a new link.`;
    } else if (err instanceof ApiError && err.status === 404) {
      errorMessage = "We couldn't find this survey. Double check the link, or ask them to send you a new one.";
    } else {
      errorMessage = "Something went wrong loading this survey. Try refreshing, or ask them to send you a new link.";
    }
  }

  if (!survey) {
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

  return <SurveyFormClient token={token} personFirstName={survey.personFirstName} fields={survey.fields} />;
}
