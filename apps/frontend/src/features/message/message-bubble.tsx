"use client";

import type { Message, User } from "@duplex/shared";
import { Loader2, RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { PendingMessage } from "./queries";

function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SystemMessage({ message }: { message: Message }) {
  return (
    <p className="flex justify-center py-1">
      <span className="rounded-full border-2 border-hairline bg-surface-raised px-3 py-1 text-center text-2xs text-muted-foreground">
        {message.body}
      </span>
    </p>
  );
}

export function MessageBubble({
  message,
  mine,
  showTail,
  senderName,
  avatar,
  gutter = false,
}: {
  message: Message;
  mine: boolean;
  showTail: boolean;
  senderName?: string | null;
  avatar?: Pick<User, "displayName" | "avatarUrl"> | null;
  gutter?: boolean;
}) {
  const deleted = message.deletedAt !== null;

  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {gutter && !mine ? (
        <span className="w-8 shrink-0">
          {avatar != null ? (
            <UserAvatar user={avatar} className="size-8 rounded-lg" />
          ) : null}
        </span>
      ) : null}

      <div
        className={cn(
          "max-w-[min(32rem,78%)] rounded-bubble border-2 border-ink px-3.5 py-2 shadow-sticker-sm",
          mine
            ? "bg-bubble-out text-bubble-out-foreground"
            : "bg-bubble-in text-bubble-in-foreground",
          showTail && (mine ? "rounded-br-md" : "rounded-bl-md"),
        )}
      >
        {senderName != null ? (
          <p className="mb-0.5 font-display text-2xs font-semibold opacity-70">
            {senderName}
          </p>
        ) : null}

        <p
          className={cn(
            "break-words whitespace-pre-wrap",
            deleted && "italic opacity-60",
          )}
        >
          {deleted ? "This message was deleted" : message.body}
        </p>

        <span className="mt-0.5 flex items-center justify-end gap-1 text-2xs opacity-70">
          {clockOf(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function PendingBubble({
  pending,
  onRetry,
}: {
  pending: PendingMessage;
  onRetry: () => void;
}) {
  const failed = pending.status === "failed";

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[min(32rem,78%)] flex-col items-end gap-1">
        <div
          className={cn(
            "rounded-bubble rounded-br-md border-2 border-ink px-3.5 py-2 shadow-sticker-sm",
            failed
              ? "border-destructive/60 bg-destructive/10 text-foreground"
              : "bg-bubble-out text-bubble-out-foreground opacity-70",
          )}
        >
          <p className="break-words whitespace-pre-wrap">{pending.body}</p>

          <span className="mt-0.5 flex items-center justify-end gap-1 text-2xs opacity-80">
            {failed ? (
              <>
                <TriangleAlert className="size-3" />
                Not sent
              </>
            ) : (
              <>
                <Loader2 className="size-3 animate-spin" />
                Sending
              </>
            )}
          </span>
        </div>

        {failed ? (
          <Button size="xs" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-3" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
