import { z } from "zod";
import { zId } from "./ids";
import { zCallKind, zCallStatus } from "./enums";
import { zSendMessageBody, zEditMessageBody, zMessage } from "./message";
import { zConversationSummary } from "./conversation";
import { zPresence } from "./user";
import { zApiError } from "./errors";

export const zSendMessageEvent = zSendMessageBody.safeExtend({
  conversationId: zId,
});
export type SendMessageEvent = z.infer<typeof zSendMessageEvent>;

export const zEditMessageEvent = zEditMessageBody.extend({
  messageId: zId,
});
export type EditMessageEvent = z.infer<typeof zEditMessageEvent>;

export const zDeleteMessageEvent = z.object({ messageId: zId });
export type DeleteMessageEvent = z.infer<typeof zDeleteMessageEvent>;

export const zToggleReactionEvent = z.object({
  messageId: zId,

  emoji: z.string().min(1).max(16),
});
export type ToggleReactionEvent = z.infer<typeof zToggleReactionEvent>;

export const zTypingEvent = z.object({ conversationId: zId });
export type TypingEvent = z.infer<typeof zTypingEvent>;

export const zReadAckEvent = z.object({
  conversationId: zId,
  lastMessageId: zId,
});
export type ReadAckEvent = z.infer<typeof zReadAckEvent>;

export const zCallInviteEvent = z.object({
  conversationId: zId,
  kind: zCallKind,
});
export type CallInviteEvent = z.infer<typeof zCallInviteEvent>;

export const zCallIdEvent = z.object({ callId: z.uuid() });
export type CallIdEvent = z.infer<typeof zCallIdEvent>;

export const zCallSdpEvent = z.object({
  callId: z.uuid(),
  description: z.object({
    type: z.enum(["offer", "answer"]),
    sdp: z.string().max(64_000),
  }),
});
export type CallSdpEvent = z.infer<typeof zCallSdpEvent>;

export const zCallIceEvent = z.object({
  callId: z.uuid(),
  candidate: z.object({
    candidate: z.string().max(2_000),
    sdpMid: z.string().nullable(),
    sdpMLineIndex: z.number().int().nonnegative().nullable(),
  }),
});
export type CallIceEvent = z.infer<typeof zCallIceEvent>;

export const zTypingUpdate = z.object({
  conversationId: zId,
  userIds: z.array(zId),
});
export type TypingUpdate = z.infer<typeof zTypingUpdate>;

export const zReadUpdate = z.object({
  conversationId: zId,
  userId: zId,
  lastMessageId: zId,
});
export type ReadUpdate = z.infer<typeof zReadUpdate>;

export const zMessageDeleted = z.object({
  conversationId: zId,
  messageId: zId,
  deletedAt: z.iso.datetime(),
});
export type MessageDeleted = z.infer<typeof zMessageDeleted>;

export const zCallIncoming = z.object({
  callId: z.uuid(),
  conversationId: zId,
  callerId: zId,
  kind: zCallKind,
});
export type CallIncoming = z.infer<typeof zCallIncoming>;

export const zCallEnded = z.object({
  callId: z.uuid(),
  status: zCallStatus,
});
export type CallEnded = z.infer<typeof zCallEnded>;

export type Ack<T> =
  | { ok: true; data: T }
  | { ok: false; error: z.infer<typeof zApiError>["error"] };

export type AckFn<T> = (response: Ack<T>) => void;

export interface ClientToServerEvents {
  "message:send": (payload: SendMessageEvent, ack: AckFn<Message>) => void;
  "message:edit": (payload: EditMessageEvent, ack: AckFn<Message>) => void;
  "message:delete": (payload: DeleteMessageEvent, ack: AckFn<null>) => void;
  "reaction:toggle": (payload: ToggleReactionEvent, ack: AckFn<Message>) => void;
  "typing:start": (payload: TypingEvent) => void;
  "typing:stop": (payload: TypingEvent) => void;
  "read:ack": (payload: ReadAckEvent) => void;
  "call:invite": (payload: CallInviteEvent, ack: AckFn<{ callId: string }>) => void;
  "call:accept": (payload: CallIdEvent) => void;
  "call:decline": (payload: CallIdEvent) => void;
  "call:hangup": (payload: CallIdEvent) => void;
  "call:sdp": (payload: CallSdpEvent) => void;
  "call:ice": (payload: CallIceEvent) => void;
}

export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:updated": (message: Message) => void;
  "message:deleted": (payload: MessageDeleted) => void;
  "reaction:updated": (message: Message) => void;
  "typing:update": (payload: TypingUpdate) => void;
  "read:update": (payload: ReadUpdate) => void;
  "presence:update": (payload: Presence) => void;
  "conversation:upsert": (conversation: ConversationSummary) => void;
  "conversation:removed": (payload: { conversationId: string }) => void;
  "call:incoming": (payload: CallIncoming) => void;
  "call:accepted": (payload: CallIdEvent) => void;
  "call:sdp": (payload: CallSdpEvent) => void;
  "call:ice": (payload: CallIceEvent) => void;
  "call:ended": (payload: CallEnded) => void;
}

export interface SocketData {
  userId: string;
}

type Message = z.infer<typeof zMessage>;
type ConversationSummary = z.infer<typeof zConversationSummary>;
type Presence = z.infer<typeof zPresence>;

export const CLIENT_EVENT_SCHEMAS = {
  "message:send": zSendMessageEvent,
  "message:edit": zEditMessageEvent,
  "message:delete": zDeleteMessageEvent,
  "reaction:toggle": zToggleReactionEvent,
  "typing:start": zTypingEvent,
  "typing:stop": zTypingEvent,
  "read:ack": zReadAckEvent,
  "call:invite": zCallInviteEvent,
  "call:accept": zCallIdEvent,
  "call:decline": zCallIdEvent,
  "call:hangup": zCallIdEvent,
  "call:sdp": zCallSdpEvent,
  "call:ice": zCallIceEvent,
} as const satisfies Partial<Record<keyof ClientToServerEvents, z.ZodType>>;

export const ROOM = {
  user: (userId: string) => `user:${userId}`,
  conversation: (conversationId: string) => `conv:${conversationId}`,
} as const;
