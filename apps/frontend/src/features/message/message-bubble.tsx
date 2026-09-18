"use client";

import type { Message } from "@duplex/shared";
import { Check, Loader2, RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingMessage } from "./queries";

function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  mine,
  showTail,
}: {
  message: Message;
  mine: boolean;
  showTail: boolean;
}) {
  const deleted = message.deletedAt !== null;

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(32rem,78%)] rounded-bubble border-2 border-ink px-3.5 py-2 shadow-sticker-sm",
          mine
            ? "bg-bubble-out text-bubble-out-foreground"
            : "bg-bubble-in text-bubble-in-foreground",
          showTail && (mine ? "rounded-br-md" : "rounded-bl-md"),
        )}
      >
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
          {mine ? <Check className="size-3" /> : null}
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
