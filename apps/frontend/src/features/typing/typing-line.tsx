"use client";

import type { ConversationDetail } from "@duplex/shared";

import { TypingDots } from "@/components/brand";

function sentence(
  conversation: ConversationDetail | null,
  userIds: string[],
): string | null {
  if (userIds.length === 0) return null;
  if (conversation === null || conversation.type === "direct") return "typing";

  const names = userIds
    .map(
      (userId) =>
        conversation.members.find((member) => member.user.id === userId)?.user
          .displayName,
    )
    .filter((name): name is string => name !== undefined);

  if (names.length === 0) return "Someone is typing";
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;

  return `${names.length} people are typing`;
}

export function TypingLine({
  conversation,
  userIds,
}: {
  conversation: ConversationDetail | null;
  userIds: string[];
}) {
  const label = sentence(conversation, userIds);

  return (
    <p
      aria-live="polite"
      className="flex h-5 shrink-0 items-center gap-1.5 px-3 text-2xs text-muted-foreground md:px-4"
    >
      {label === null ? null : (
        <>
          <span className="truncate">{label}</span>
          <TypingDots className="[&>span]:size-1" />
        </>
      )}
    </p>
  );
}
