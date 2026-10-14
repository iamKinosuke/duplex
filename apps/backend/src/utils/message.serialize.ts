import {
  REACTION_EMOJIS,
  type Message,
  type MessageType,
  type ReactionEmoji,
  type ReactionGroup,
  type ReactionSummary,
  type ReplyPreview,
} from "@duplex/shared";

import type { MessageRow } from "../repositories/message.repository.js";
import { MessageType as PrismaMessageType } from "../generated/prisma/client.js";
import { id, iso, optionalId, optionalIso } from "./serialize.js";

const MESSAGE_TYPE: Record<PrismaMessageType, MessageType> = {
  [PrismaMessageType.TEXT]: "text",
  [PrismaMessageType.IMAGE]: "image",
  [PrismaMessageType.FILE]: "file",
  [PrismaMessageType.VOICE]: "voice",
  [PrismaMessageType.SYSTEM]: "system",
};

const TO_PRISMA_TYPE: Record<MessageType, PrismaMessageType> = {
  text: PrismaMessageType.TEXT,
  image: PrismaMessageType.IMAGE,
  file: PrismaMessageType.FILE,
  voice: PrismaMessageType.VOICE,
  system: PrismaMessageType.SYSTEM,
};

export function fromMessageType(type: MessageType): PrismaMessageType {
  return TO_PRISMA_TYPE[type];
}

const REPLY_PREVIEW_MAX = 120;

function groupByEmoji(
  rows: MessageRow["reactions"],
): Array<[ReactionEmoji, bigint[]]> {
  const byEmoji = new Map<string, bigint[]>();

  for (const row of rows) {
    const list = byEmoji.get(row.emoji);

    if (list === undefined) byEmoji.set(row.emoji, [row.userId]);
    else list.push(row.userId);
  }

  return REACTION_EMOJIS.flatMap((emoji) => {
    const userIds = byEmoji.get(emoji);
    return userIds === undefined || userIds.length === 0
      ? []
      : [[emoji, userIds] as [ReactionEmoji, bigint[]]];
  });
}

function toReactions(
  rows: MessageRow["reactions"],
  viewerId: bigint,
): ReactionSummary[] {
  return groupByEmoji(rows).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    mine: userIds.some((userId) => userId === viewerId),
  }));
}

export function toReactionGroups(rows: MessageRow["reactions"]): ReactionGroup[] {
  return groupByEmoji(rows).map(([emoji, userIds]) => ({
    emoji,
    userIds: userIds.map(id),
  }));
}

function toReplyPreview(row: MessageRow["replyTo"]): ReplyPreview | null {
  if (row === null) return null;

  const deleted = row.deletedAt !== null;
  const body = deleted ? null : (row.body?.slice(0, REPLY_PREVIEW_MAX) ?? null);

  return { id: id(row.id), senderId: id(row.senderId), body, deleted };
}

export function toMessage(row: MessageRow, viewerId: bigint): Message {
  const deletedAt = optionalIso(row.deletedAt);

  return {
    id: id(row.id),
    conversationId: id(row.conversationId),
    senderId: id(row.senderId),
    type: MESSAGE_TYPE[row.type],
    body: deletedAt === null ? row.body : null,
    replyToId: optionalId(row.replyToId),
    replyTo: toReplyPreview(row.replyTo),
    clientMsgId: row.clientMsgId,
    attachments: [],
    reactions: toReactions(row.reactions, viewerId),
    editedAt: optionalIso(row.editedAt),
    deletedAt,
    createdAt: iso(row.createdAt),
  };
}

export function toOptionalMessage(
  row: MessageRow | null,
  viewerId: bigint,
): Message | null {
  return row === null ? null : toMessage(row, viewerId);
}
