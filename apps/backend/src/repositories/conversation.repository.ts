import { randomUUID } from "node:crypto";

import {
  ConversationType,
  MemberRole,
  MessageType,
  Prisma,
  type PrismaClient,
} from "../generated/prisma/client.js";
import { messageSelect, type MessageRow } from "./message.repository.js";
import { publicUserSelect } from "./user.repository.js";

const summarySelect = {
  role: true,
  mutedUntil: true,
  lastReadMessageId: true,
  conversation: {
    select: {
      id: true,
      type: true,
      name: true,
      avatarUrl: true,
      updatedAt: true,
      lastMessage: { select: messageSelect },
      members: {
        take: 2,
        select: { userId: true, user: { select: publicUserSelect } },
      },
      _count: { select: { members: true } },
    },
  },
} satisfies Prisma.ConversationMemberSelect;

const detailSelect = {
  id: true,
  type: true,
  name: true,
  avatarUrl: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  lastMessage: { select: messageSelect },
  members: {
    select: {
      role: true,
      lastReadMessageId: true,
      mutedUntil: true,
      joinedAt: true,
      userId: true,
      user: { select: publicUserSelect },
    },
    orderBy: [{ joinedAt: "asc" }],
  },
  _count: { select: { members: true } },
} satisfies Prisma.ConversationSelect;

export type ConversationSummaryRow = Prisma.ConversationMemberGetPayload<{
  select: typeof summarySelect;
}>;

export type ConversationDetailRow = Prisma.ConversationGetPayload<{
  select: typeof detailSelect;
}>;

export interface UnreadCount {
  conversationId: bigint;
  unread: number;
}

export interface DirectResult {
  conversation: ConversationDetailRow;
  created: boolean;
}

export interface CreateGroupInput {
  ownerId: bigint;
  name: string;
  avatarUrl: string | null;
  memberIds: bigint[];
  systemBody: string;
}

export interface GroupWriteResult {
  conversation: ConversationDetailRow;
  systemMessage: MessageRow;
}

export interface AddMembersInput {
  conversationId: bigint;
  actorId: bigint;
  memberIds: bigint[];
  systemBody: string;
}

export interface RemoveMemberInput {
  conversationId: bigint;
  actorId: bigint;
  memberId: bigint;
  systemBody: string;
}

export interface TransferOwnerInput {
  conversationId: bigint;
  currentOwnerId: bigint;
  nextOwnerId: bigint;
  systemBody: string;
}

export interface MemberUnread {
  userId: bigint;
  unread: number;
}

export interface ConversationRepository {
  listForUser(userId: bigint): Promise<ConversationSummaryRow[]>;
  idsForUser(userId: bigint): Promise<bigint[]>;
  peerIdsIn(conversationIds: bigint[], excludeUserId: bigint): Promise<bigint[]>;
  unreadCountsFor(userId: bigint): Promise<UnreadCount[]>;
  unreadCountIn(
    conversationId: bigint,
    userId: bigint,
    lastReadMessageId: bigint,
  ): Promise<number>;
  findForMember(
    conversationId: bigint,
    userId: bigint,
  ): Promise<ConversationDetailRow | null>;
  membershipOf(
    conversationId: bigint,
    userId: bigint,
  ): Promise<{ lastReadMessageId: bigint } | null>;
  markRead(
    conversationId: bigint,
    userId: bigint,
    lastMessageId: bigint,
  ): Promise<boolean>;
  createDirect(userId: bigint, peerId: bigint): Promise<DirectResult>;
  createGroup(input: CreateGroupInput): Promise<GroupWriteResult>;
  addMembers(input: AddMembersInput): Promise<GroupWriteResult>;
  removeMember(input: RemoveMemberInput): Promise<GroupWriteResult>;
  transferOwner(input: TransferOwnerInput): Promise<GroupWriteResult>;
  unreadByMember(conversationId: bigint): Promise<MemberUnread[]>;
}

export function directKeyFor(a: bigint, b: bigint): string {
  const [low, high] = a < b ? [a, b] : [b, a];
  return `${low}:${high}`;
}

async function writeSystemMessage(
  tx: Prisma.TransactionClient,
  conversationId: bigint,
  senderId: bigint,
  body: string,
): Promise<MessageRow> {
  const message = await tx.message.create({
    data: {
      conversationId,
      senderId,
      type: MessageType.SYSTEM,
      body,
      clientMsgId: randomUUID(),
    },
    select: messageSelect,
  });

  await tx.conversation.update({
    where: { id: conversationId },
    data: { lastMessageId: message.id },
  });

  return message;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function createConversationRepository(
  client: PrismaClient,
): ConversationRepository {
  async function findByDirectKey(
    directKey: string,
  ): Promise<ConversationDetailRow | null> {
    return await client.conversation.findUnique({
      where: { directKey },
      select: detailSelect,
    });
  }

  async function detailInTransaction(
    tx: Prisma.TransactionClient,
    conversationId: bigint,
  ): Promise<ConversationDetailRow> {
    return await tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: detailSelect,
    });
  }

  return {
    async listForUser(userId) {
      return await client.conversationMember.findMany({
        where: { userId },
        select: summarySelect,
        orderBy: { conversation: { updatedAt: "desc" } },
      });
    },

    async idsForUser(userId) {
      const rows = await client.conversationMember.findMany({
        where: { userId },
        select: { conversationId: true },
      });

      return rows.map((row) => row.conversationId);
    },

    async peerIdsIn(conversationIds, excludeUserId) {
      if (conversationIds.length === 0) return [];

      const rows = await client.conversationMember.findMany({
        where: {
          conversationId: { in: conversationIds },
          userId: { not: excludeUserId },
        },
        select: { userId: true },
        distinct: ["userId"],
      });

      return rows.map((row) => row.userId);
    },

    async unreadCountsFor(userId) {
      const rows = await client.$queryRaw<
        Array<{ conversationId: bigint; unread: bigint }>
      >`
        SELECT m.conversation_id AS conversationId, COUNT(*) AS unread
        FROM messages m
        JOIN conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.user_id = ${userId}
        WHERE m.id > cm.last_read_message_id
          AND m.deleted_at IS NULL
          AND m.sender_id <> cm.user_id
          AND m.type <> 'SYSTEM'
        GROUP BY m.conversation_id
      `;

      return rows.map((row) => ({
        conversationId: row.conversationId,
        unread: Number(row.unread),
      }));
    },

    async unreadCountIn(conversationId, userId, lastReadMessageId) {
      return await client.message.count({
        where: {
          conversationId,
          id: { gt: lastReadMessageId },
          deletedAt: null,
          senderId: { not: userId },
          type: { not: MessageType.SYSTEM },
        },
      });
    },

    async findForMember(conversationId, userId) {
      return await client.conversation.findFirst({
        where: { id: conversationId, members: { some: { userId } } },
        select: detailSelect,
      });
    },

    async membershipOf(conversationId, userId) {
      return await client.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
        select: { lastReadMessageId: true },
      });
    },

    async markRead(conversationId, userId, lastMessageId) {
      const result = await client.conversationMember.updateMany({
        where: {
          conversationId,
          userId,
          lastReadMessageId: { lt: lastMessageId },
        },
        data: { lastReadMessageId: lastMessageId },
      });

      return result.count === 1;
    },

    async createDirect(userId, peerId) {
      const directKey = directKeyFor(userId, peerId);

      const existing = await findByDirectKey(directKey);
      if (existing !== null) {
        return { conversation: existing, created: false };
      }

      try {
        const created = await client.conversation.create({
          data: {
            type: ConversationType.DIRECT,
            directKey,
            members: {
              create: [
                { userId, role: MemberRole.MEMBER },
                { userId: peerId, role: MemberRole.MEMBER },
              ],
            },
          },
          select: detailSelect,
        });

        return { conversation: created, created: true };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        const raced = await findByDirectKey(directKey);
        if (raced === null) throw error;

        return { conversation: raced, created: false };
      }
    },

    async createGroup(input) {
      return await client.$transaction(async (tx) => {
        const created = await tx.conversation.create({
          data: {
            type: ConversationType.GROUP,
            name: input.name,
            avatarUrl: input.avatarUrl,
            ownerId: input.ownerId,
            members: {
              create: [
                { userId: input.ownerId, role: MemberRole.OWNER },
                ...input.memberIds.map((userId) => ({
                  userId,
                  role: MemberRole.MEMBER,
                })),
              ],
            },
          },
          select: { id: true },
        });

        const systemMessage = await writeSystemMessage(
          tx,
          created.id,
          input.ownerId,
          input.systemBody,
        );

        return {
          conversation: await detailInTransaction(tx, created.id),
          systemMessage,
        };
      });
    },

    async addMembers(input) {
      return await client.$transaction(async (tx) => {
        await tx.conversationMember.createMany({
          data: input.memberIds.map((userId) => ({
            conversationId: input.conversationId,
            userId,
            role: MemberRole.MEMBER,
          })),
        });

        const systemMessage = await writeSystemMessage(
          tx,
          input.conversationId,
          input.actorId,
          input.systemBody,
        );

        return {
          conversation: await detailInTransaction(tx, input.conversationId),
          systemMessage,
        };
      });
    },

    async removeMember(input) {
      return await client.$transaction(async (tx) => {
        await tx.conversationMember.delete({
          where: {
            conversationId_userId: {
              conversationId: input.conversationId,
              userId: input.memberId,
            },
          },
        });

        const systemMessage = await writeSystemMessage(
          tx,
          input.conversationId,
          input.actorId,
          input.systemBody,
        );

        return {
          conversation: await detailInTransaction(tx, input.conversationId),
          systemMessage,
        };
      });
    },

    async transferOwner(input) {
      return await client.$transaction(async (tx) => {
        await tx.conversationMember.update({
          where: {
            conversationId_userId: {
              conversationId: input.conversationId,
              userId: input.currentOwnerId,
            },
          },
          data: { role: MemberRole.MEMBER },
        });

        await tx.conversationMember.update({
          where: {
            conversationId_userId: {
              conversationId: input.conversationId,
              userId: input.nextOwnerId,
            },
          },
          data: { role: MemberRole.OWNER },
        });

        await tx.conversation.update({
          where: { id: input.conversationId },
          data: { ownerId: input.nextOwnerId },
        });

        const systemMessage = await writeSystemMessage(
          tx,
          input.conversationId,
          input.currentOwnerId,
          input.systemBody,
        );

        return {
          conversation: await detailInTransaction(tx, input.conversationId),
          systemMessage,
        };
      });
    },

    async unreadByMember(conversationId) {
      const rows = await client.$queryRaw<
        Array<{ userId: bigint; unread: bigint }>
      >`
        SELECT cm.user_id AS userId, COUNT(m.id) AS unread
        FROM conversation_members cm
        LEFT JOIN messages m
          ON m.conversation_id = cm.conversation_id
          AND m.id > cm.last_read_message_id
          AND m.deleted_at IS NULL
          AND m.sender_id <> cm.user_id
          AND m.type <> 'SYSTEM'
        WHERE cm.conversation_id = ${conversationId}
        GROUP BY cm.user_id
      `;

      return rows.map((row) => ({
        userId: row.userId,
        unread: Number(row.unread),
      }));
    },
  };
}
