"use client";

import { useQuery } from "@tanstack/react-query";
import { zLinkPreview, type LinkPreview } from "@duplex/shared";

import { apiFetch } from "@/lib/api";

export const linkKeys = {
  preview: (url: string) => ["link", url] as const,
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/iu;

export function firstUrlIn(body: string | null): string | null {
  if (body === null) return null;

  return URL_PATTERN.exec(body)?.[0] ?? null;
}

export function useLinkPreview(url: string) {
  return useQuery<LinkPreview | null>({
    queryKey: linkKeys.preview(url),
    queryFn: () =>
      apiFetch({
        path: `/api/links/preview?url=${encodeURIComponent(url)}`,
        schema: zLinkPreview.nullable(),
      }),
    staleTime: Infinity,
    retry: false,
  });
}
