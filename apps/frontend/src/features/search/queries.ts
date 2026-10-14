"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { LIMITS, zMessagePage, type MessagePage } from "@duplex/shared";

import { apiFetch } from "@/lib/api";

export const searchKeys = {
  messages: (term: string) => ["search", "messages", term] as const,
};

export function useMessageSearch(term: string) {
  const query = term.trim();

  return useInfiniteQuery({
    queryKey: searchKeys.messages(query),
    enabled: query.length >= 2,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch({
        path:
          `/api/messages/search?q=${encodeURIComponent(query)}` +
          `&limit=${LIMITS.page.default}` +
          (pageParam === null ? "" : `&before=${pageParam}`),
        schema: zMessagePage,
      }),
    getNextPageParam: (last: MessagePage) => last.nextCursor,
    staleTime: 15_000,
  });
}
