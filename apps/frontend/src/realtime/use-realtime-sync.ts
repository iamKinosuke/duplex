"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  ConversationRemoved,
  ConversationSummary,
  Message,
  MessageDeleted,
  MessageEdited,
  Presence,
  ReactionUpdate,
  ReadUpdate,
  TypingUpdate,
} from "@duplex/shared";

import {
  advanceReadCursor,
  conversationKeys,
  patchLastMessage,
  removeConversation,
  upsertConversation,
} from "@/features/conversation/queries";
import { openConversationId } from "@/features/conversation/route";
import {
  appendMessage,
  dropPending,
  messageKeys,
  patchMessage,
} from "@/features/message/queries";
import { applyPresence } from "@/features/presence/queries";
import { applyTyping, clearTyping } from "@/features/typing/queries";
import { useSession } from "@/features/auth/session";
import { useSocket } from "./socket-provider";

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
      clearTyping(client, message.conversationId, message.senderId);
      advanceReadCursor(
        client,
        message.conversationId,
        message.senderId,
        message.id,
      );

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

    function onEdited({
      conversationId,
      messageId,
      body,
      editedAt,
    }: MessageEdited): void {
      const patch = (message: Message): Message => ({
        ...message,
        body,
        editedAt,
      });

      patchMessage(client, conversationId, messageId, patch);
      patchLastMessage(client, conversationId, messageId, patch);
    }

    function onDeleted({
      conversationId,
      messageId,
      deletedAt,
    }: MessageDeleted): void {
      const patch = (message: Message): Message => ({
        ...message,
        body: null,
        deletedAt,
      });

      patchMessage(client, conversationId, messageId, patch);
      patchLastMessage(client, conversationId, messageId, patch);
    }

    function onReaction({
      conversationId,
      messageId,
      reactions,
    }: ReactionUpdate): void {
      patchMessage(client, conversationId, messageId, (message) => ({
        ...message,
        reactions: reactions
          .filter((group) => group.userIds.length > 0)
          .map((group) => ({
            emoji: group.emoji,
            count: group.userIds.length,
            mine: group.userIds.some((userId) => userId === myId),
          })),
      }));
    }

    function onTyping(update: TypingUpdate): void {
      applyTyping(client, update);
    }

    function onRead(update: ReadUpdate): void {
      advanceReadCursor(
        client,
        update.conversationId,
        update.userId,
        update.lastMessageId,
      );
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
    socket.on("message:updated", onEdited);
    socket.on("message:deleted", onDeleted);
    socket.on("reaction:updated", onReaction);
    socket.on("typing:update", onTyping);
    socket.on("read:update", onRead);
    socket.on("conversation:removed", onRemoved);

    return () => {
      socket.off("message:new", onMessage);
      socket.off("conversation:upsert", onConversation);
      socket.off("presence:update", onPresence);
      socket.off("message:updated", onEdited);
      socket.off("message:deleted", onDeleted);
      socket.off("reaction:updated", onReaction);
      socket.off("typing:update", onTyping);
      socket.off("read:update", onRead);
      socket.off("conversation:removed", onRemoved);
    };
  }, [socket, client, router, myId, activeId]);
}
