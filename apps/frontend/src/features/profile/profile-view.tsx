"use client";

import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { FormAlert } from "@/features/auth/form-alert";
import { useSession } from "@/features/auth/session";
import { useOpenDirect } from "@/features/conversation/queries";
import { useIsOnline } from "@/features/presence/queries";
import { useProfile } from "./queries";

function lastSeen(iso: string | null): string {
  if (iso === null) return "Not seen yet";

  return `Last seen ${new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function ProfileView({ username }: { username: string }) {
  const profile = useProfile(username);
  const session = useSession();
  const router = useRouter();
  const openDirect = useOpenDirect();

  const [error, setError] = useState<string | null>(null);
  const online = useIsOnline(profile.data?.id);

  async function message() {
    if (profile.data === undefined) return;

    setError(null);

    try {
      const conversation = await openDirect.mutateAsync(profile.data.id);
      router.push(`/c/${conversation.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not open that chat.",
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-header shrink-0 items-center gap-3 border-b-2 border-hairline bg-background/85 px-3 backdrop-blur md:px-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to your chats</span>
          </Link>
        </Button>
        <p className="font-display text-sm font-semibold">Profile</p>
      </header>

      <div className="grid flex-1 place-items-center p-6">
        {profile.isPending ? (
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="mx-auto size-24 rounded-2xl" />
            <Skeleton className="mx-auto h-5 w-40 rounded-lg" />
            <Skeleton className="mx-auto h-4 w-24 rounded-lg" />
          </div>
        ) : profile.data === undefined ? (
          <div className="space-y-3 text-center">
            <h2 className="font-display text-xl font-semibold">
              Nobody here is called “{username}”
            </h2>
            <Button asChild variant="outline">
              <Link href="/">Back to your chats</Link>
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-5 text-center">
            <UserAvatar
              user={profile.data}
              className="mx-auto size-24 rounded-2xl shadow-sticker"
              online={online}
            />

            <div className="space-y-1">
              <h2 className="font-display text-2xl font-semibold">
                {profile.data.displayName}
              </h2>
              <p className="text-sm text-muted-foreground">
                @{profile.data.username}
              </p>
            </div>

            {profile.data.bio !== null ? (
              <p className="text-sm">{profile.data.bio}</p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {online ? "Online right now" : lastSeen(profile.data.lastSeenAt)}
            </p>

            {error !== null ? <FormAlert message={error} /> : null}

            {session.data?.id === profile.data.id ? (
              <p className="text-xs text-muted-foreground">This is you.</p>
            ) : (
              <Button
                onClick={() => void message()}
                disabled={openDirect.isPending}
              >
                {openDirect.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <MessageCircle />
                )}
                Message
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
