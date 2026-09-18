"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  ConversationRemoved,
  ConversationSummary,
  Message,
  Presence,
} from "@duplex/shared";

import {
  conversationKeys,
  removeConversation,
  upsertConversation,
} from "@/features/conversation/queries";
import {
  appendMessage,
  dropPending,
  messageKeys,
} from "@/features/message/queries";
import { applyPresence } from "@/features/presence/queries";
import { useSession } from "@/features/auth/session";
import { useSocket } from "./socket-provider";

function openConversationId(pathname: string): string | null {
  const match = /^\/c\/(\d+)/u.exec(pathname);
  return match?.[1] ?? null;
}

export function useRealtimeSync(): void {
  const socket = useSocket();
  const client = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  const myId = session.data?.id ?? null;
  const activeId = openConversationId(pathname);

  useEffect(() => {
    if (socket === null) return;

    function onMessage(message: Message): void {
      appendMessage(client, message.conversationId, message);
      dropPending(client, message.conversationId, message.clientMsgId);

      const mine = myId !== null && message.senderId === myId;
      const reading = activeId === message.conversationId;
      const counts = !mine && !reading && message.type !== "system";

      client.setQueryData<ConversationSummary[]>(
        conversationKeys.all,
        (current) => {
          if (current === undefined) return current;

          const target = current.find(
            (item) => item.id === message.conversationId,
          );
          if (target === undefined) return current;

          const updated: ConversationSummary = {
            ...target,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: counts ? target.unreadCount + 1 : target.unreadCount,
          };

          return [
            updated,
            ...current.filter((item) => item.id !== message.conversationId),
          ];
        },
      );
    }

    function onConversation(conversation: ConversationSummary): void {
      upsertConversation(client, conversation);
    }

    function onPresence(update: Presence): void {
      applyPresence(client, update);
    }

    function onRemoved({ conversationId }: ConversationRemoved): void {
      removeConversation(client, conversationId);
      client.removeQueries({ queryKey: messageKeys.history(conversationId) });
      client.removeQueries({ queryKey: messageKeys.pending(conversationId) });

      if (activeId === conversationId) router.replace("/");
    }

    socket.on("message:new", onMessage);
    socket.on("conversation:upsert", onConversation);
    socket.on("presence:update", onPresence);
    socket.on("conversation:removed", onRemoved);

    return () => {
      socket.off("message:new", onMessage);
      socket.off("conversation:upsert", onConversation);
      socket.off("presence:update", onPresence);
      socket.off("conversation:removed", onRemoved);
    };
  }, [socket, client, router, myId, activeId]);
}
