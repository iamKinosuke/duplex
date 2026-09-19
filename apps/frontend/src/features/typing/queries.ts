"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { TIMINGS, type TypingUpdate } from "@duplex/shared";

export const typingKey = ["typing"] as const;

export type TypingMap = Record<string, string[]>;

const NOBODY: string[] = [];

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(conversationId: string, userId: string): string {
  return `${conversationId}:${userId}`;
}

function forgetTimer(conversationId: string, userId: string): void {
  const key = timerKey(conversationId, userId);
  const timer = timers.get(key);

  if (timer === undefined) return;

  clearTimeout(timer);
  timers.delete(key);
}

export function applyTyping(client: QueryClient, update: TypingUpdate): void {
  client.setQueryData<TypingMap>(typingKey, (current) => ({
    ...(current ?? {}),
    [update.conversationId]: [...update.userIds],
  }));

  const stillTyping = new Set<string>(update.userIds);

  for (const key of [...timers.keys()]) {
    const [conversationId, userId] = key.split(":");

    if (conversationId !== update.conversationId || userId === undefined) {
      continue;
    }

    if (!stillTyping.has(userId)) forgetTimer(conversationId, userId);
  }

  for (const userId of update.userIds) {
    forgetTimer(update.conversationId, userId);

    timers.set(
      timerKey(update.conversationId, userId),
      setTimeout(() => {
        clearTyping(client, update.conversationId, userId);
      }, TIMINGS.typingTtlSeconds * 1000),
    );
  }
}

export function clearTyping(
  client: QueryClient,
  conversationId: string,
  userId: string,
): void {
  forgetTimer(conversationId, userId);

  client.setQueryData<TypingMap>(typingKey, (current) => {
    const room = current?.[conversationId];

    if (current === undefined || room === undefined) return current;
    if (!room.includes(userId)) return current;

    return {
      ...current,
      [conversationId]: room.filter((id) => id !== userId),
    };
  });
}

export function useTypingMap(): TypingMap {
  const query = useQuery<TypingMap>({
    queryKey: typingKey,
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return query.data ?? {};
}

export function useTypingIn(
  conversationId: string,
  exceptUserId: string | null,
): string[] {
  const room = useTypingMap()[conversationId] ?? NOBODY;

  return room.filter((userId) => userId !== exceptUserId);
}
