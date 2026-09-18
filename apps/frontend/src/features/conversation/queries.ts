"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  zConversationDetail,
  zConversationList,
  zUserList,
  type ConversationDetail,
  type ConversationSummary,
  type User,
} from "@duplex/shared";

import { apiFetch } from "@/lib/api";

export const conversationKeys = {
  all: ["conversations"] as const,
  detail: (id: string) => ["conversations", id] as const,
};

export function useConversations(): UseQueryResult<ConversationSummary[]> {
  return useQuery({
    queryKey: conversationKeys.all,
    queryFn: async () => {
      const page = await apiFetch({
        path: "/api/conversations",
        schema: zConversationList,
      });
      return page.items;
    },
  });
}

export function useConversation(
  id: string,
): UseQueryResult<ConversationDetail> {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () =>
      apiFetch({
        path: `/api/conversations/${id}`,
        schema: zConversationDetail,
      }),
  });
}

export function useUserSearch(term: string): UseQueryResult<User[]> {
  const query = term.trim();

  return useQuery({
    queryKey: ["users", "search", query],
    enabled: query.length > 0,
    queryFn: async () => {
      const page = await apiFetch({
        path: `/api/users?q=${encodeURIComponent(query)}`,
        schema: zUserList,
      });
      return page.items;
    },
  });
}

export function useOpenDirect() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch({
        path: "/api/conversations/direct",
        method: "POST",
        body: { userId },
        schema: zConversationDetail,
      }),
    onSuccess: (conversation) => {
      client.setQueryData(conversationKeys.detail(conversation.id), conversation);
      upsertConversation(client, conversation);
    },
  });
}

export function upsertConversation(
  client: QueryClient,
  conversation: ConversationSummary,
): void {
  client.setQueryData<ConversationSummary[]>(conversationKeys.all, (current) => {
    const rest = (current ?? []).filter((item) => item.id !== conversation.id);
    return [conversation, ...rest];
  });
}
