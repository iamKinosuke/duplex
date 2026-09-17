import type {
  ConversationDetail,
  ConversationSummary,
  ConversationType,
  Member,
  MemberRole,
} from "@duplex/shared";

import type {
  ConversationDetailRow,
  ConversationSummaryRow,
} from "../repositories/conversation.repository.js";
import {
  ConversationType as PrismaConversationType,
  MemberRole as PrismaMemberRole,
} from "../generated/prisma/client.js";
import { toOptionalMessage } from "./message.serialize.js";
import { id, iso, optionalId, optionalIso, toUser } from "./serialize.js";

const CONVERSATION_TYPE: Record<PrismaConversationType, ConversationType> = {
  [PrismaConversationType.DIRECT]: "direct",
  [PrismaConversationType.GROUP]: "group",
};

const MEMBER_ROLE: Record<PrismaMemberRole, MemberRole> = {
  [PrismaMemberRole.OWNER]: "owner",
  [PrismaMemberRole.ADMIN]: "admin",
  [PrismaMemberRole.MEMBER]: "member",
};

export function toSummary(
  row: ConversationSummaryRow,
  viewerId: bigint,
  unreadCount: number,
): ConversationSummary {
  const conversation = row.conversation;
  const isDirect = conversation.type === PrismaConversationType.DIRECT;
  const peerRow = conversation.members.find(
    (member) => member.userId !== viewerId,
  );

  return {
    id: id(conversation.id),
    type: CONVERSATION_TYPE[conversation.type],
    name: conversation.name,
    avatarUrl: conversation.avatarUrl,
    peer: isDirect && peerRow !== undefined ? toUser(peerRow.user) : null,
    memberCount: conversation._count.members,
    lastMessage: toOptionalMessage(conversation.lastMessage),
    unreadCount,
    mutedUntil: optionalIso(row.mutedUntil),
    myRole: MEMBER_ROLE[row.role],
    updatedAt: iso(conversation.updatedAt),
  };
}

export function toDetail(
  row: ConversationDetailRow,
  viewerId: bigint,
  unreadCount: number,
): ConversationDetail {
  const me = row.members.find((member) => member.userId === viewerId);
  const isDirect = row.type === PrismaConversationType.DIRECT;
  const peerRow = row.members.find((member) => member.userId !== viewerId);

  const members: Member[] = row.members.map((member) => ({
    user: toUser(member.user),
    role: MEMBER_ROLE[member.role],
    lastReadMessageId: id(member.lastReadMessageId),
    joinedAt: iso(member.joinedAt),
  }));

  return {
    id: id(row.id),
    type: CONVERSATION_TYPE[row.type],
    name: row.name,
    avatarUrl: row.avatarUrl,
    peer: isDirect && peerRow !== undefined ? toUser(peerRow.user) : null,
    memberCount: row._count.members,
    lastMessage: toOptionalMessage(row.lastMessage),
    unreadCount,
    mutedUntil: me === undefined ? null : optionalIso(me.mutedUntil),
    myRole: me === undefined ? "member" : MEMBER_ROLE[me.role],
    updatedAt: iso(row.updatedAt),
    members,
    ownerId: optionalId(row.ownerId),
    createdAt: iso(row.createdAt),
  };
}
