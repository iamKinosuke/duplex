import {
  ConversationType,
  MemberRole,
  Prisma,
  type PrismaClient,
} from "../generated/prisma/client.js";
import { messageSelect } from "./message.repository.js";
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
  createDirect(userId: bigint, peerId: bigint): Promise<DirectResult>;
}

export function directKeyFor(a: bigint, b: bigint): string {
  const [low, high] = a < b ? [a, b] : [b, a];
  return `${low}:${high}`;
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
  };
}
