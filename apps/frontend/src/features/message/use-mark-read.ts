"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toId, type ConversationSummary } from "@duplex/shared";

import { conversationKeys } from "@/features/conversation/queries";
import { useSocket, useSocketConnected } from "@/realtime/socket-provider";

export function useMarkRead(
  conversationId: string,
  newestMessageId: string | null,
): void {
  const socket = useSocket();
  const connected = useSocketConnected();
  const client = useQueryClient();
  const acknowledged = useRef<string | null>(null);

  useEffect(() => {
    acknowledged.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (socket === null || !connected) return;
    if (newestMessageId === null) return;
    if (acknowledged.current === newestMessageId) return;

    acknowledged.current = newestMessageId;

    socket.emit("read:ack", {
      conversationId: toId(conversationId),
      lastMessageId: toId(newestMessageId),
    });

    client.setQueryData<ConversationSummary[]>(
      conversationKeys.all,
      (current) =>
        current?.map((item) =>
          item.id === conversationId ? { ...item, unreadCount: 0 } : item,
        ),
    );
  }, [socket, connected, conversationId, newestMessageId, client]);
}
