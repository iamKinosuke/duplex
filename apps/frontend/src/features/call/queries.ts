"use client";

import { useQuery } from "@tanstack/react-query";
import { zIceConfig, type IceConfig } from "@duplex/shared";

import { apiFetch } from "@/lib/api";

export const callKeys = {
  ice: ["calls", "ice"] as const,
};

export function useIceConfig() {
  return useQuery<IceConfig>({
    queryKey: callKeys.ice,
    queryFn: () => apiFetch({ path: "/api/calls/ice", schema: zIceConfig }),
    staleTime: 10 * 60 * 1000,
  });
}
