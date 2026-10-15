import { z } from "zod";

export const zIceServer = z.object({
  urls: z.array(z.string()),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof zIceServer>;

export const zIceConfig = z.object({
  iceServers: z.array(zIceServer),
});
export type IceConfig = z.infer<typeof zIceConfig>;

export const CALL_RING_MS = 45_000;
