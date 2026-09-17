import { z } from "zod";
import { zId } from "./ids";
import { zConversationType, zMemberRole } from "./enums";
import { LIMITS } from "./limits";
import { zUser } from "./user";
import { zMessage } from "./message";

export const zMember = z.object({
  user: zUser,
  role: zMemberRole,
  lastReadMessageId: zId,
  joinedAt: z.iso.datetime(),
});
export type Member = z.infer<typeof zMember>;

export const zConversationSummary = z.object({
  id: zId,
  type: zConversationType,
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),

  peer: zUser.nullable(),
  memberCount: z.number().int().positive(),
  lastMessage: zMessage.nullable(),
  unreadCount: z.number().int().nonnegative(),
  mutedUntil: z.iso.datetime().nullable(),
  myRole: zMemberRole,
  updatedAt: z.iso.datetime(),
});
export type ConversationSummary = z.infer<typeof zConversationSummary>;

export const zConversationDetail = zConversationSummary.extend({
  members: z.array(zMember),
  ownerId: zId.nullable(),
  createdAt: z.iso.datetime(),
});
export type ConversationDetail = z.infer<typeof zConversationDetail>;

export const zConversationList = z.object({
  items: z.array(zConversationSummary),
});
export type ConversationList = z.infer<typeof zConversationList>;

export const zCreateDirectBody = z.object({
  userId: zId,
});
export type CreateDirectBody = z.infer<typeof zCreateDirectBody>;

export const zCreateGroupBody = z.object({
  name: z.string().trim().min(LIMITS.groupName.min).max(LIMITS.groupName.max),
  memberIds: z.array(zId).min(1).max(LIMITS.groupMembers.max),
  avatarUrl: z.string().max(512).nullish(),
});
export type CreateGroupBody = z.infer<typeof zCreateGroupBody>;

export const zReadAckBody = z.object({
  lastMessageId: zId,
});
export type ReadAckBody = z.infer<typeof zReadAckBody>;
