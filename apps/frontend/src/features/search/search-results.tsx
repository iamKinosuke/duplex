"use client";

import type { ConversationSummary, Message } from "@duplex/shared";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useConversations } from "@/features/conversation/queries";
import { useMessageSearch } from "./queries";

function titleOf(
  conversations: ConversationSummary[],
  conversationId: string,
): string {
  const found = conversations.find((item) => item.id === conversationId);

  return (
    found?.peer?.displayName ?? found?.name ?? "A conversation you are in"
  );
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
  });
}

export function SearchResults({ term }: { term: string }) {
  const results = useMessageSearch(term);
  const conversations = useConversations();

  const hits: Message[] = (results.data?.pages ?? []).flatMap(
    (page) => page.items,
  );

  if (results.isPending && term.trim().length >= 2) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="mr-1.5 inline size-3 animate-spin" />
        Searching…
      </p>
    );
  }

  if (hits.length === 0) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground">
        No messages match “{term.trim()}”.
      </p>
    );
  }

  return (
    <div className="space-y-1 px-2 pb-2">
      {hits.map((message) => (
        <Link
          key={message.id}
          href={`/c/${message.conversationId}?m=${message.id}`}
          className="block rounded-xl border-2 border-transparent px-2.5 py-2 transition-colors duration-(--duration-fast) hover:border-hairline hover:bg-surface-raised"
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-display text-xs font-semibold">
              {titleOf(conversations.data ?? [], message.conversationId)}
            </span>
            <span className="shrink-0 text-2xs text-muted-foreground">
              {shortTime(message.createdAt)}
            </span>
          </span>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {message.body}
          </span>
        </Link>
      ))}

      {results.hasNextPage ? (
        <div className="flex justify-center pt-1">
          <Button
            size="xs"
            variant="outline"
            onClick={() => void results.fetchNextPage()}
            disabled={results.isFetchingNextPage}
          >
            {results.isFetchingNextPage ? (
              <Loader2 className="animate-spin" />
            ) : null}
            More results
          </Button>
        </div>
      ) : null}
    </div>
  );
}
