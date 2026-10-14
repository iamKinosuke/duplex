"use client";

import type { Message, ReactionEmoji } from "@duplex/shared";
import { Loader2 } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversation } from "@/features/conversation/queries";
import {
  MessageBubble,
  PendingBubble,
  SystemMessage,
  type BubbleActions,
} from "./message-bubble";
import { metaFor } from "./message-meta";
import { receiptLabel } from "./read-receipt";
import {
  useDeleteMessage,
  useEditMessage,
  useMessageHistory,
  usePendingMessages,
  useToggleReaction,
  type PendingMessage,
} from "./queries";
import { useReadReceipt } from "./use-read-receipt";

const HIGHLIGHT_MS = 1_400;

export function MessageList({
  conversationId,
  myId,
  onRetry,
  onReply,
}: {
  conversationId: string;
  myId: string;
  onRetry: (pending: PendingMessage) => void;
  onReply: (message: Message) => void;
}) {
  const history = useMessageHistory(conversationId);
  const pending = usePendingMessages(conversationId);
  const conversation = useConversation(conversationId);

  const edit = useEditMessage(conversationId);
  const remove = useDeleteMessage(conversationId);
  const react = useToggleReaction(conversationId);

  const [editing, setEditing] = useState<{
    conversationId: string;
    messageId: string;
  } | null>(null);
  const [confirming, setConfirming] = useState<Message | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const anchorHeight = useRef<number | null>(null);
  const stickToBottom = useRef(true);

  const messages: Message[] = (history.data?.pages ?? [])
    .flatMap((page) => page.items)
    .reverse();

  const newest = messages.at(-1)?.id ?? null;
  const pendingCount = pending.length;

  let lastMine: string | null = null;
  for (const message of messages) {
    if (message.senderId === myId) lastMine = message.id;
  }

  const receipt = useReadReceipt(conversationId, myId, lastMine);

  const editingId =
    editing?.conversationId === conversationId ? editing.messageId : null;

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

  useEffect(() => {
    if (highlighted === null) return;

    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  useEffect(() => {
    if (failure === null) return;

    const timer = setTimeout(() => setFailure(null), 4_000);
    return () => clearTimeout(timer);
  }, [failure]);

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

  function report(cause: unknown, fallback: string) {
    setFailure(cause instanceof Error ? cause.message : fallback);
  }

  function nameOf(userId: string): string | null {
    return (
      conversation.data?.members.find((member) => member.user.id === userId)
        ?.user.displayName ?? null
    );
  }

  const actions: BubbleActions = {
    onReply,

    onJump: (messageId) => {
      const node = scroller.current?.querySelector(
        `[data-message-id="${messageId}"]`,
      );

      if (node === null || node === undefined) return;

      stickToBottom.current = false;
      node.scrollIntoView({ block: "center", behavior: "smooth" });
      setHighlighted(messageId);
    },

    onReact: (messageId, emoji: ReactionEmoji) => {
      react.mutate(
        { messageId, emoji },
        { onError: (cause) => report(cause, "Could not react.") },
      );
    },

    onDelete: (message) => setConfirming(message),

    onStartEdit: (messageId) => setEditing({ conversationId, messageId }),

    onCancelEdit: () => setEditing(null),

    onSubmitEdit: (messageId, body) => {
      edit.mutate(
        { messageId, body },
        {
          onSuccess: () => setEditing(null),
          onError: (cause) => report(cause, "Could not save that edit."),
        },
      );
    },
  };

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
      className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4"
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
          const meta = metaFor(
            messages,
            index,
            myId,
            conversation.data ?? null,
          );

          if (meta === null) return null;

          const sender =
            conversation.data?.members.find(
              (member) => member.user.id === message.senderId,
            )?.user ?? null;

          return (
            <Fragment key={message.id}>
              {meta.kind === "system" ? (
                <SystemMessage message={message} />
              ) : (
                <MessageBubble
                  message={message}
                  mine={meta.mine}
                  showTail={meta.endsRun}
                  senderName={meta.senderName}
                  avatar={meta.endsRun ? sender : null}
                  gutter={conversation.data?.type === "group"}
                  replyAuthor={
                    message.replyTo === null
                      ? null
                      : nameOf(message.replyTo.senderId)
                  }
                  highlighted={highlighted === message.id}
                  editing={editingId === message.id}
                  busy={edit.isPending}
                  actions={actions}
                />
              )}

              {message.id === lastMine && receipt !== null ? (
                <p className="pt-0.5 pr-1 text-right text-2xs text-muted-foreground">
                  {receiptLabel(receipt)}
                </p>
              ) : null}
            </Fragment>
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

      {failure !== null ? (
        <p className="sticky bottom-0 flex justify-center pt-2">
          <span className="rounded-full border-2 border-destructive/60 bg-destructive/10 px-3 py-1 text-2xs font-medium">
            {failure}
          </span>
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        title="Delete this message?"
        description="Everyone in the conversation will see that it was deleted."
        confirmLabel="Delete"
        pending={remove.isPending}
        onConfirm={() => {
          if (confirming === null) return;

          remove.mutate(confirming.id, {
            onSuccess: () => setConfirming(null),
            onError: (cause) => report(cause, "Could not delete that message."),
          });
        }}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      />
    </div>
  );
}
