import { z } from "zod";

export const zLinkPreview = z.object({
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.string().nullable(),
  siteName: z.string().nullable(),
});
export type LinkPreview = z.infer<typeof zLinkPreview>;

export const zLinkPreviewQuery = z.object({
  url: z.string().min(8).max(2_000),
});
export type LinkPreviewQuery = z.infer<typeof zLinkPreviewQuery>;
