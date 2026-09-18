"use client";

import type { ConversationSummary } from "@duplex/shared";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useIsOnline } from "@/features/presence/queries";
import { cn } from "@/lib/utils";
import { useConversations } from "./queries";

function shortTime(iso: string): string {
  const at = new Date(iso);
  const sameDay = new Date().toDateString() === at.toDateString();

  return sameDay
    ? at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : at.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

export function ConversationList() {
  const conversations = useConversations();

  if (conversations.isPending) {
    return (
      <div className="space-y-2 px-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const items = conversations.data ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-3 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-hairline px-5 py-10 text-center">
        <p className="font-display font-semibold">Nothing here yet</p>
        <p className="text-xs text-muted-foreground">
          Use the pencil above to start a conversation.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1 px-2">
      {items.map((conversation) => (
        <li key={conversation.id}>
          <ConversationRow conversation={conversation} />
        </li>
      ))}
    </ul>
  );
}

function ConversationRow({
  conversation,
}: {
  conversation: ConversationSummary;
}) {
  const params = useParams<{ id?: string }>();
  const active = params.id === conversation.id;
  const online = useIsOnline(conversation.peer?.id);

  const title =
    conversation.peer?.displayName ?? conversation.name ?? "Conversation";
  const preview = conversation.lastMessage?.body ?? "No messages yet";

  return (
    <Link
      href={`/c/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border-2 px-2.5 py-2 transition-colors duration-(--duration-fast)",
        active
          ? "border-ink bg-card shadow-sticker-sm"
          : "border-transparent hover:border-hairline hover:bg-surface-raised",
      )}
    >
      <UserAvatar
        user={
          conversation.peer ?? {
            displayName: title,
            avatarUrl: conversation.avatarUrl,
          }
        }
        online={online}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-sm font-semibold">
            {title}
          </span>
          {conversation.lastMessage !== null ? (
            <span className="shrink-0 text-2xs text-muted-foreground">
              {shortTime(conversation.lastMessage.createdAt)}
            </span>
          ) : null}
        </span>

        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {preview}
          </span>
          {conversation.unreadCount > 0 ? (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full border-2 border-ink bg-primary px-1.5 font-display text-2xs font-bold text-primary-foreground">
              {conversation.unreadCount}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
