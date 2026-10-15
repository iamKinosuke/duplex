"use client";

import { ArrowLeft, Info, Loader2, Phone, Reply, Video, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Message, ReplyPreview } from "@duplex/shared";
import { randomUUID } from "@/lib/uuid";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/features/auth/session";
import { MessageList } from "@/features/message/message-list";
import { Composer } from "@/features/message/composer";
import {
  useMessageHistory,
  useSendMessage,
  type PendingMessage,
} from "@/features/message/queries";
import { useMarkRead } from "@/features/message/use-mark-read";
import { useIsOnline } from "@/features/presence/queries";
import { useTypingIn } from "@/features/typing/queries";
import { TypingLine } from "@/features/typing/typing-line";
import { useTypingSignal } from "@/features/typing/use-typing-signal";
import { useCall } from "@/features/call/call-provider";
import { ConversationPanel } from "./conversation-panel";
import { useConversation } from "./queries";

export function ConversationView({ conversationId }: { conversationId: string }) {
  const session = useSession();
  const conversation = useConversation(conversationId);
  const send = useSendMessage(conversationId);
  const history = useMessageHistory(conversationId);

  const newestMessageId = history.data?.pages[0]?.items[0]?.id ?? null;
  useMarkRead(conversationId, newestMessageId);

  const peer = conversation.data?.peer ?? null;
  const online = useIsOnline(peer?.id);
  const myId = session.data?.id ?? null;

  const [details, setDetails] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);

  const call = useCall();
  const typing = useTypingSignal(conversationId);
  const typists = useTypingIn(conversationId, myId);

  function submit(body: string) {
    typing.onSent();
    send.mutate({ clientMsgId: randomUUID(), body, replyTo });
    setReplyTo(null);
  }

  function retry(pending: PendingMessage) {
    send.mutate({
      clientMsgId: pending.clientMsgId,
      body: pending.body,
      replyTo: pending.replyTo,
    });
  }

  function quote(message: Message) {
    setReplyTo({
      id: message.id,
      senderId: message.senderId,
      body: (message.body ?? "").slice(0, 120),
      deleted: message.deletedAt !== null,
    });
  }

  if (conversation.isError) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            This conversation is not available
          </h2>
          <Button asChild variant="outline">
            <Link href="/">Back to your chats</Link>
          </Button>
        </div>
      </div>
    );
  }

  const title = peer?.displayName ?? conversation.data?.name ?? "Conversation";
  const group = conversation.data?.type === "group";

  const subtitle = group
    ? `${conversation.data?.memberCount ?? 0} members`
    : online
      ? "online"
      : "offline";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-header shrink-0 items-center gap-3 border-b-2 border-hairline bg-background/85 px-3 backdrop-blur md:px-4">
        <Button variant="ghost" size="icon-sm" className="md:hidden" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to conversations</span>
          </Link>
        </Button>

        {conversation.isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <UserAvatar
              user={
                peer ?? {
                  displayName: title,
                  avatarUrl: conversation.data?.avatarUrl ?? null,
                }
              }
              className="size-9"
              online={group ? undefined : online}
            />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">
                {title}
              </p>
              <p className="truncate text-2xs text-muted-foreground">
                {subtitle}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {group ? null : (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={call.state.phase !== "idle"}
                    onClick={() => void call.start(conversationId, "audio")}
                  >
                    <Phone className="size-4" />
                    <span className="sr-only">Start a voice call</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={call.state.phase !== "idle"}
                    onClick={() => void call.start(conversationId, "video")}
                  >
                    <Video className="size-4" />
                    <span className="sr-only">Start a video call</span>
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                className="xl:hidden"
                onClick={() => setDetails(true)}
              >
                <Info className="size-4" />
                <span className="sr-only">Conversation details</span>
              </Button>
            </div>
          </>
        )}
      </header>

      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl border-2 border-ink p-0 shadow-sticker-lg sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Conversation details</DialogTitle>
          </DialogHeader>

          <ConversationPanel conversationId={conversationId} />
        </DialogContent>
      </Dialog>

      {myId === null ? null : (
        <MessageList
          conversationId={conversationId}
          myId={myId}
          onRetry={retry}
          onReply={quote}
        />
      )}

      <TypingLine conversation={conversation.data ?? null} userIds={typists} />

      {replyTo !== null ? (
        <div className="flex shrink-0 items-center gap-2 border-t-2 border-hairline bg-surface-raised px-3 py-2 md:px-4">
          <Reply className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-2xs font-semibold">
              Replying to{" "}
              {conversation.data?.members.find(
                (member) => member.user.id === replyTo.senderId,
              )?.user.displayName ?? "someone"}
            </span>
            <span className="block truncate text-2xs text-muted-foreground">
              {replyTo.deleted ? "This message was deleted" : replyTo.body}
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setReplyTo(null)}
          >
            <X />
            <span className="sr-only">Cancel reply</span>
          </Button>
        </div>
      ) : null}

      <Composer
        onSend={submit}
        onType={typing.onInput}
        disabled={conversation.isPending}
      />
    </div>
  );
}
