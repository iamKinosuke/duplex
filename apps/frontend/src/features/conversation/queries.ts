"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  toId,
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

export function useCreateGroup() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; memberIds: string[] }) =>
      apiFetch({
        path: "/api/conversations/group",
        method: "POST",
        body,
        schema: zConversationDetail,
      }),
    onSuccess: (conversation) => keepDetail(client, conversation),
  });
}

export function useAddMembers(conversationId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (userIds: string[]) =>
      apiFetch({
        path: `/api/conversations/${conversationId}/members`,
        method: "POST",
        body: { userIds },
        schema: zConversationDetail,
      }),
    onSuccess: (conversation) => keepDetail(client, conversation),
  });
}

export function useRemoveMember(conversationId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch({
        path: `/api/conversations/${conversationId}/members/${userId}`,
        method: "DELETE",
        schema: zConversationDetail,
      }),
    onSuccess: (conversation) => keepDetail(client, conversation),
  });
}

export function useTransferOwner(conversationId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch({
        path: `/api/conversations/${conversationId}/owner`,
        method: "POST",
        body: { userId },
        schema: zConversationDetail,
      }),
    onSuccess: (conversation) => keepDetail(client, conversation),
  });
}

export function useLeaveConversation(conversationId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (myId: string) =>
      apiFetch<void>({
        path: `/api/conversations/${conversationId}/members/${myId}`,
        method: "DELETE",
      }),
    onSuccess: () => removeConversation(client, conversationId),
  });
}

function keepDetail(client: QueryClient, conversation: ConversationDetail): void {
  client.setQueryData(conversationKeys.detail(conversation.id), conversation);
  upsertConversation(client, conversation);
}

export function advanceReadCursor(
  client: QueryClient,
  conversationId: string,
  userId: string,
  lastMessageId: string,
): void {
  client.setQueryData<ConversationDetail>(
    conversationKeys.detail(conversationId),
    (current) => {
      if (current === undefined) return current;

      const index = current.members.findIndex(
        (member) => member.user.id === userId,
      );
      const member = index === -1 ? undefined : current.members[index];

      if (member === undefined) return current;
      if (BigInt(member.lastReadMessageId) >= BigInt(lastMessageId)) {
        return current;
      }

      const members = [...current.members];
      members[index] = { ...member, lastReadMessageId: toId(lastMessageId) };

      return { ...current, members };
    },
  );
}

export function removeConversation(
  client: QueryClient,
  conversationId: string,
): void {
  client.setQueryData<ConversationSummary[]>(conversationKeys.all, (current) =>
    (current ?? []).filter((item) => item.id !== conversationId),
  );

  client.removeQueries({ queryKey: conversationKeys.detail(conversationId) });
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
