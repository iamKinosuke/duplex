"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { zUser, type User } from "@duplex/shared";

import { apiFetch } from "@/lib/api";

export const profileKeys = {
  detail: (username: string) => ["profile", username] as const,
};

export function useProfile(username: string): UseQueryResult<User> {
  return useQuery({
    queryKey: profileKeys.detail(username),
    queryFn: () =>
      apiFetch({
        path: `/api/users/${encodeURIComponent(username)}`,
        schema: zUser,
      }),
    retry: false,
  });
}
