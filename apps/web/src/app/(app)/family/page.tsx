"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Users, Mail, UserMinus, LogOut } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { SecretSantaSection } from "@/components/family/secret-santa-section";
import { api, ApiError } from "@/lib/api";
import type { FamilyStatus } from "@/lib/api";
import { toast } from "sonner";

export default function FamilyPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<FamilyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const tier = session?.user?.subscriptionTier || "free";

  async function load() {
    if (!session?.accessToken) return;
    try {
      const result = await api.getMyFamily(session.accessToken);
      setStatus(result);
    } catch {
      // leave status null — treated as "none" below
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  async function handleCreateGroup() {
    if (!session?.accessToken) return;
    setCreating(true);
    try {
      await api.createFamilyGroup(session.accessToken, groupName.trim() || undefined);
      toast.success("Family group created.");
      setGroupName("");
      await load();
    } catch {
      toast.error("Failed to create family group.");
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    if (!session?.accessToken || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.inviteFamilyMember(session.accessToken, inviteEmail.trim());
      toast.success(`Invite sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberUserId: string) {
    if (!session?.accessToken) return;
    setBusyUserId(memberUserId);
    try {
      await api.removeFamilyMember(session.accessToken, memberUserId);
      toast.success("Member removed.");
      await load();
    } catch {
      toast.error("Failed to remove member.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleLeave() {
    if (!session?.accessToken) return;
    setLeaving(true);
    try {
      await api.leaveFamily(session.accessToken);
      toast.success("You've left the family plan.");
      await load();
    } catch {
      toast.error("Failed to leave family plan.");
    } finally {
      setLeaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-lg mx-auto py-6 px-4 sm:px-6 sm:py-8 md:px-8">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const role = status?.role ?? "none";

  return (
    <div className="container max-w-lg mx-auto py-6 px-4 sm:px-6 sm:py-8 md:px-8">
      <h1 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2">
        <Users className="h-6 w-6" />
        Family Plan
      </h1>

      {role === "none" && tier !== "family" && (
        <UpgradePrompt message="The Family plan lets one subscription cover your whole household — plus Secret Santa, gift pooling, and a shared calendar." />
      )}

      {role === "none" && tier === "family" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Set up your family group</CardTitle>
            <CardDescription>
              You&apos;re on the Family plan — create a group so you can invite people.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="groupName">Family name (optional)</Label>
              <Input
                id="groupName"
                placeholder="The Smiths"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateGroup} disabled={creating}>
              {creating ? "Creating..." : "Create Family Group"}
            </Button>
          </CardContent>
        </Card>
      )}

      {role === "owner" && status?.group && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {status.group.name || "Your family group"}
            </CardTitle>
            <CardDescription>
              {status.group.seatsUsed} of {status.group.seatsMax} seats used
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {status.group.members.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No members yet — invite someone below.
                </p>
              )}
              {status.group.members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                  <div>
                    <p className="font-medium">{m.name || m.email}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyUserId === m.userId}
                    onClick={() => handleRemove(m.userId)}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {status.group.seatsUsed < status.group.seatsMax && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="them@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-1.5 shrink-0">
                  <Mail className="h-3.5 w-3.5" />
                  {inviting ? "Sending..." : "Invite"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {role === "member" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {status?.familyName || "Family plan"}
            </CardTitle>
            <CardDescription>
              You&apos;re on {status?.ownerName || status?.ownerEmail}&apos;s family plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleLeave} disabled={leaving} className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              {leaving ? "Leaving..." : "Leave family plan"}
            </Button>
          </CardContent>
        </Card>
      )}

      {(role === "owner" || role === "member") && session?.accessToken && session.user?.id && (
        <div className="mt-4">
          <SecretSantaSection
            token={session.accessToken}
            myUserId={session.user.id}
            peers={role === "owner" ? (status?.group?.members ?? []) : (status?.peers ?? [])}
          />
        </div>
      )}

      {role === "none" && (
        <p className="text-sm text-muted-foreground mt-4">
          <Link href="/upgrade" className="underline">See plans</Link>
        </p>
      )}
    </div>
  );
}
