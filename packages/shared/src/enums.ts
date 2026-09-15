import { z } from "zod";

export const zConversationType = z.enum(["direct", "group"]);
export type ConversationType = z.infer<typeof zConversationType>;

export const zMemberRole = z.enum(["owner", "admin", "member"]);
export type MemberRole = z.infer<typeof zMemberRole>;

export const zMessageType = z.enum(["text", "image", "file", "voice", "system"]);
export type MessageType = z.infer<typeof zMessageType>;

export const zPresenceStatus = z.enum(["online", "away", "offline"]);
export type PresenceStatus = z.infer<typeof zPresenceStatus>;

export const zCallKind = z.enum(["audio", "video"]);
export type CallKind = z.infer<typeof zCallKind>;

export const zCallStatus = z.enum(["missed", "declined", "ended", "busy"]);
export type CallStatus = z.infer<typeof zCallStatus>;
