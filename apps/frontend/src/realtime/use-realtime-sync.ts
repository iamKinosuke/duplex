"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { ConversationSummary, Message, Presence } from "@duplex/shared";

import { conversationKeys, upsertConversation } from "@/features/conversation/queries";
import { appendMessage, dropPending } from "@/features/message/queries";
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
            unreadCount:
              mine || reading ? target.unreadCount : target.unreadCount + 1,
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

    socket.on("message:new", onMessage);
    socket.on("conversation:upsert", onConversation);
    socket.on("presence:update", onPresence);

    return () => {
      socket.off("message:new", onMessage);
      socket.off("conversation:upsert", onConversation);
      socket.off("presence:update", onPresence);
    };
  }, [socket, client, myId, activeId]);
}
