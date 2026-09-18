"use client";

import type { Message } from "@duplex/shared";
import { Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBubble, PendingBubble } from "./message-bubble";
import {
  useMessageHistory,
  usePendingMessages,
  type PendingMessage,
} from "./queries";

export function MessageList({
  conversationId,
  myId,
  onRetry,
}: {
  conversationId: string;
  myId: string;
  onRetry: (pending: PendingMessage) => void;
}) {
  const history = useMessageHistory(conversationId);
  const pending = usePendingMessages(conversationId);

  const scroller = useRef<HTMLDivElement>(null);
  const anchorHeight = useRef<number | null>(null);
  const stickToBottom = useRef(true);

  const messages: Message[] = (history.data?.pages ?? [])
    .flatMap((page) => page.items)
    .reverse();

  const newest = messages.at(-1)?.id ?? null;
  const pendingCount = pending.length;

  useLayoutEffect(() => {
    const node = scroller.current;
    if (node === null) return;

    if (anchorHeight.current !== null) {
      node.scrollTop = node.scrollHeight - anchorHeight.current;
      anchorHeight.current = null;
      return;
    }

    if (stickToBottom.current) node.scrollTop = node.scrollHeight;
  }, [newest, pendingCount, conversationId]);

  useEffect(() => {
    stickToBottom.current = true;
  }, [conversationId]);

  function onScroll() {
    const node = scroller.current;
    if (node === null) return;

    stickToBottom.current =
      node.scrollHeight - node.scrollTop - node.clientHeight < 80;

    if (node.scrollTop < 120 && history.hasNextPage && !history.isFetchingNextPage) {
      anchorHeight.current = node.scrollHeight;
      void history.fetchNextPage();
    }
  }

  if (history.isPending) {
    return (
      <div className="flex-1 space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton
            key={index}
            className={index % 2 === 0 ? "h-12 w-2/3 rounded-bubble" : "ml-auto h-12 w-1/2 rounded-bubble"}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
      {history.hasNextPage ? (
        <div className="mb-3 flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
          >
            {history.isFetchingNextPage ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Older messages
          </Button>
        </div>
      ) : (
        <p className="mb-4 text-center text-2xs text-muted-foreground">
          This is the beginning of the conversation.
        </p>
      )}

      <div className="space-y-1.5">
        {messages.map((message, index) => {
          const next = messages[index + 1];
          const lastOfRun = next === undefined || next.senderId !== message.senderId;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.senderId === myId}
              showTail={lastOfRun}
            />
          );
        })}

        {pending.map((item) => (
          <PendingBubble
            key={item.clientMsgId}
            pending={item}
            onRetry={() => onRetry(item)}
          />
        ))}
      </div>
    </div>
  );
}
