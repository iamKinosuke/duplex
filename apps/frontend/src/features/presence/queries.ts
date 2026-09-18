"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { Presence, PresenceStatus } from "@duplex/shared";

export const presenceKey = ["presence"] as const;

export type PresenceMap = Record<string, PresenceStatus>;

export function applyPresence(client: QueryClient, update: Presence): void {
  client.setQueryData<PresenceMap>(presenceKey, (current) => ({
    ...(current ?? {}),
    [update.userId]: update.status,
  }));
}

export function usePresence(): PresenceMap {
  const query = useQuery<PresenceMap>({
    queryKey: presenceKey,
    queryFn: () => ({}),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return query.data ?? {};
}

export function useIsOnline(userId: string | null | undefined): boolean {
  const presence = usePresence();
  return userId != null && presence[userId] === "online";
}
