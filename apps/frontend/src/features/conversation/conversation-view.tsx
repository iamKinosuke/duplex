"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { randomUUID } from "@/lib/uuid";

import { Button } from "@/components/ui/button";
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

  const typing = useTypingSignal(conversationId);
  const typists = useTypingIn(conversationId, myId);

  function submit(body: string) {
    typing.onSent();
    send.mutate({ clientMsgId: randomUUID(), body });
  }

  function retry(pending: PendingMessage) {
    send.mutate({ clientMsgId: pending.clientMsgId, body: pending.body });
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
              user={peer ?? { displayName: title, avatarUrl: null }}
              className="size-9"
              online={online}
            />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold">
                {title}
              </p>
              <p className="truncate text-2xs text-muted-foreground">
                {online ? "online" : "offline"}
              </p>
            </div>
          </>
        )}
      </header>

      {myId === null ? null : (
        <MessageList
          conversationId={conversationId}
          myId={myId}
          onRetry={retry}
        />
      )}

      <TypingLine conversation={conversation.data ?? null} userIds={typists} />

      <Composer
        onSend={submit}
        onType={typing.onInput}
        disabled={conversation.isPending}
      />
    </div>
  );
}
