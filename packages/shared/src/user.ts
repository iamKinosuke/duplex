import { z } from "zod";
import { zId } from "./ids";
import { LIMITS } from "./limits";
import { zPresenceStatus } from "./enums";

export const zUser = z.object({
  id: zId,
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
});
export type User = z.infer<typeof zUser>;

export const zMe = zUser.extend({ email: z.email() });
export type Me = z.infer<typeof zMe>;

export const zUpdateProfileBody = z.object({
  displayName: z
    .string()
    .trim()
    .min(LIMITS.displayName.min)
    .max(LIMITS.displayName.max)
    .optional(),
  bio: z.string().trim().max(LIMITS.bio.max).nullable().optional(),
  avatarUrl: z.string().max(512).nullable().optional(),
});
export type UpdateProfileBody = z.infer<typeof zUpdateProfileBody>;

export const zUserList = z.object({
  items: z.array(zUser),
});
export type UserList = z.infer<typeof zUserList>;

export const zUserSearchQuery = z.object({
  q: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});
export type UserSearchQuery = z.infer<typeof zUserSearchQuery>;

export const zPresence = z.object({
  userId: zId,
  status: zPresenceStatus,
  lastSeenAt: z.iso.datetime().nullable(),
});
export type Presence = z.infer<typeof zPresence>;
