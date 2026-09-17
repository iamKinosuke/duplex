import type { Message, MessageType } from "@duplex/shared";

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

export function toMessage(row: MessageRow): Message {
  const deletedAt = optionalIso(row.deletedAt);

  return {
    id: id(row.id),
    conversationId: id(row.conversationId),
    senderId: id(row.senderId),
    type: MESSAGE_TYPE[row.type],
    body: deletedAt === null ? row.body : null,
    replyToId: optionalId(row.replyToId),
    clientMsgId: row.clientMsgId,
    attachments: [],
    reactions: [],
    editedAt: optionalIso(row.editedAt),
    deletedAt,
    createdAt: iso(row.createdAt),
  };
}

export function toOptionalMessage(row: MessageRow | null): Message | null {
  return row === null ? null : toMessage(row);
}
