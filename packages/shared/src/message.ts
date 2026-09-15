import { z } from "zod";
import { zId, zCursor } from "./ids";
import { zMessageType } from "./enums";
import { LIMITS } from "./limits";

export const zAttachment = z.object({
  id: zId,
  url: z.string(),
  thumbUrl: z.string().nullable(),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationMs: z.number().int().positive().nullable(),
});
export type Attachment = z.infer<typeof zAttachment>;

export const zReactionSummary = z.object({
  emoji: z.string(),
  count: z.number().int().positive(),

  mine: z.boolean(),
});
export type ReactionSummary = z.infer<typeof zReactionSummary>;

export const zMessage = z.object({
  id: zId,
  conversationId: zId,
  senderId: zId,
  type: zMessageType,
  body: z.string().nullable(),
  replyToId: zId.nullable(),
  clientMsgId: z.uuid(),
  attachments: z.array(zAttachment),
  reactions: z.array(zReactionSummary),
  editedAt: z.iso.datetime().nullable(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Message = z.infer<typeof zMessage>;

export const zSendMessageBody = z
  .object({
    clientMsgId: z.uuid(),
    type: zMessageType.exclude(["system"]).default("text"),
    body: z.string().trim().max(LIMITS.messageBody.max).nullish(),
    replyToId: zId.nullish(),
    attachmentKeys: z
      .array(z.string().max(512))
      .max(LIMITS.attachmentsPerMessage.max)
      .default([]),
  })
  .refine(
    (m) => (m.body !== null && m.body !== undefined && m.body !== "") || m.attachmentKeys.length > 0,
    { message: "a message needs text or at least one attachment" },
  );
export type SendMessageBody = z.infer<typeof zSendMessageBody>;

export const zEditMessageBody = z.object({
  body: z.string().trim().min(1).max(LIMITS.messageBody.max),
});
export type EditMessageBody = z.infer<typeof zEditMessageBody>;

export const zMessagePageQuery = z.object({
  before: zCursor,
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.page.max)
    .default(LIMITS.page.default),
});
export type MessagePageQuery = z.infer<typeof zMessagePageQuery>;

export const zMessagePage = z.object({
  items: z.array(zMessage),

  nextCursor: zId.nullable(),
});
export type MessagePage = z.infer<typeof zMessagePage>;
