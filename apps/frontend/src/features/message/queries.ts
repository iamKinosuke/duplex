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

export interface SendVariables {
  clientMsgId: string;
  body: string;
}

export function useSendMessage(conversationId: string) {
  const socket = useSocket();
  const client = useQueryClient();

  return useMutation<Message, Error, SendVariables>({
    mutationFn: async ({ clientMsgId, body }) => {
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
            attachmentKeys: [],
          },
          resolve,
        );
      });

      if (!ack.ok) throw new Error(ack.error.message);

      return ack.data;
    },

    onMutate: ({ clientMsgId, body }) => {
      setPending(client, conversationId, (list) => [
        ...list.filter((item) => item.clientMsgId !== clientMsgId),
        {
          clientMsgId,
          body,
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
