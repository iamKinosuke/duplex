"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import {
  LIMITS,
  toId,
  zMessagePage,
  type Ack,
  type Message,
  type MessagePage,
  type ReactionEmoji,
  type ReplyPreview,
} from "@duplex/shared";

import { apiFetch } from "@/lib/api";
import { ackPromise } from "@/realtime/socket";
import { useSocket } from "@/realtime/socket-provider";

export const messageKeys = {
  history: (conversationId: string) => ["messages", conversationId] as const,
  pending: (conversationId: string) => ["messages", conversationId, "pending"] as const,
};

export interface PendingMessage {
  clientMsgId: string;
  body: string;
  replyTo: ReplyPreview | null;
  createdAt: string;
  status: "sending" | "failed";
  error: string | null;
}

export function useMessageHistory(conversationId: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.history(conversationId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch({
        path:
          `/api/conversations/${conversationId}/messages` +
          `?limit=${LIMITS.page.default}` +
          (pageParam === null ? "" : `&before=${pageParam}`),
        schema: zMessagePage,
      }),
    getNextPageParam: (last: MessagePage) => last.nextCursor,
    staleTime: 15_000,
  });
}

export function usePendingMessages(conversationId: string): PendingMessage[] {
  const query = useQuery<PendingMessage[]>({
    queryKey: messageKeys.pending(conversationId),
    queryFn: () => [],
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return query.data ?? [];
}

function setPending(
  client: QueryClient,
  conversationId: string,
  update: (current: PendingMessage[]) => PendingMessage[],
): void {
  client.setQueryData<PendingMessage[]>(
    messageKeys.pending(conversationId),
    (current) => update(current ?? []),
  );
}

export function dropPending(
  client: QueryClient,
  conversationId: string,
  clientMsgId: string,
): void {
  setPending(client, conversationId, (list) =>
    list.filter((item) => item.clientMsgId !== clientMsgId),
  );
}

export function appendMessage(
  client: QueryClient,
  conversationId: string,
  message: Message,
): void {
  client.setQueryData<InfiniteData<MessagePage, string | null>>(
    messageKeys.history(conversationId),
    (current) => {
      if (current === undefined) return current;

      const [first, ...rest] = current.pages;
      if (first === undefined) return current;

      const known = current.pages.some((page) =>
        page.items.some((item) => item.id === message.id),
      );
      if (known) return current;

      return {
        ...current,
        pages: [{ ...first, items: [message, ...first.items] }, ...rest],
      };
    },
  );
}

export function patchMessage(
  client: QueryClient,
  conversationId: string,
  messageId: string,
  patch: (message: Message) => Message,
): void {
  client.setQueryData<InfiniteData<MessagePage, string | null>>(
    messageKeys.history(conversationId),
    (current) => {
      if (current === undefined) return current;

      let touched = false;

      const pages = current.pages.map((page) => {
        const index = page.items.findIndex((item) => item.id === messageId);
        const found = index === -1 ? undefined : page.items[index];

        if (found === undefined) return page;

        const items = [...page.items];
        items[index] = patch(found);
        touched = true;

        return { ...page, items };
      });

      return touched ? { ...current, pages } : current;
    },
  );
}

export interface SendVariables {
  clientMsgId: string;
  body: string;
  replyTo?: ReplyPreview | null;
}

export function useSendMessage(conversationId: string) {
  const socket = useSocket();
  const client = useQueryClient();

  return useMutation<Message, Error, SendVariables>({
    mutationFn: async ({ clientMsgId, body, replyTo }) => {
      if (socket === null || !socket.connected) {
        throw new Error("You are offline. The message was not sent.");
      }

      const ack = await ackPromise<Ack<Message>>(socket, (resolve) => {
        socket.emit(
          "message:send",
          {
            conversationId: toId(conversationId),
            clientMsgId,
            type: "text",
            body,
            replyToId: replyTo?.id ?? null,
            attachmentKeys: [],
          },
          resolve,
        );
      });

      if (!ack.ok) throw new Error(ack.error.message);

      return ack.data;
    },

    onMutate: ({ clientMsgId, body, replyTo }) => {
      setPending(client, conversationId, (list) => [
        ...list.filter((item) => item.clientMsgId !== clientMsgId),
        {
          clientMsgId,
          body,
          replyTo: replyTo ?? null,
          createdAt: new Date().toISOString(),
          status: "sending",
          error: null,
        },
      ]);
    },

    onSuccess: (message) => {
      appendMessage(client, conversationId, message);
      dropPending(client, conversationId, message.clientMsgId);
    },

    onError: (error, variables) => {
      setPending(client, conversationId, (list) =>
        list.map((item) =>
          item.clientMsgId === variables.clientMsgId
            ? { ...item, status: "failed", error: error.message }
            : item,
        ),
      );
    },
  });
}

export function useEditMessage(conversationId: string) {
  const socket = useSocket();
  const client = useQueryClient();

  return useMutation<Message, Error, { messageId: string; body: string }>({
    mutationFn: async ({ messageId, body }) => {
      if (socket === null || !socket.connected) {
        throw new Error("You are offline. Nothing was changed.");
      }

      const ack = await ackPromise<Ack<Message>>(socket, (resolve) => {
        socket.emit("message:edit", { messageId: toId(messageId), body }, resolve);
      });

      if (!ack.ok) throw new Error(ack.error.message);

      return ack.data;
    },

    onSuccess: (message) => {
      patchMessage(client, conversationId, message.id, () => message);
    },
  });
}

export function useDeleteMessage(conversationId: string) {
  const socket = useSocket();
  const client = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: async (messageId) => {
      if (socket === null || !socket.connected) {
        throw new Error("You are offline. Nothing was changed.");
      }

      const ack = await ackPromise<Ack<null>>(socket, (resolve) => {
        socket.emit("message:delete", { messageId: toId(messageId) }, resolve);
      });

      if (!ack.ok) throw new Error(ack.error.message);

      return messageId;
    },

    onSuccess: (messageId) => {
      patchMessage(client, conversationId, messageId, (message) => ({
        ...message,
        body: null,
        deletedAt: message.deletedAt ?? new Date().toISOString(),
      }));
    },
  });
}

export function useToggleReaction(conversationId: string) {
  const socket = useSocket();
  const client = useQueryClient();

  return useMutation<
    Message,
    Error,
    { messageId: string; emoji: ReactionEmoji }
  >({
    mutationFn: async ({ messageId, emoji }) => {
      if (socket === null || !socket.connected) {
        throw new Error("You are offline. Nothing was changed.");
      }

      const ack = await ackPromise<Ack<Message>>(socket, (resolve) => {
        socket.emit(
          "reaction:toggle",
          { messageId: toId(messageId), emoji },
          resolve,
        );
      });

      if (!ack.ok) throw new Error(ack.error.message);

      return ack.data;
    },

    onSuccess: (message) => {
      patchMessage(client, conversationId, message.id, () => message);
    },
  });
}
