import {
  Prisma,
  type MessageType,
  type PrismaClient,
} from "../generated/prisma/client.js";

export const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  type: true,
  body: true,
  replyToId: true,
  clientMsgId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  replyTo: {
    select: {
      id: true,
      senderId: true,
      body: true,
      deletedAt: true,
    },
  },
  reactions: {
    select: { userId: true, emoji: true },
    orderBy: [{ createdAt: "asc" }],
  },
} satisfies Prisma.MessageSelect;

const actorSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  type: true,
  deletedAt: true,
} satisfies Prisma.MessageSelect;

export type MessageActorRow = Prisma.MessageGetPayload<{
  select: typeof actorSelect;
}>;

export type MessageRow = Prisma.MessageGetPayload<{
  select: typeof messageSelect;
}>;

export interface MessageSearchOptions {
  userId: bigint;
  query: string;
  before: bigint | null;
  limit: number;
}

export interface MessagePageOptions {
  conversationId: bigint;
  before: bigint | null;
  limit: number;
}

export interface MessagePageResult {
  items: MessageRow[];
  nextCursor: bigint | null;
}

export interface CreateMessageInput {
  conversationId: bigint;
  senderId: bigint;
  type: MessageType;
  body: string | null;
  replyToId: bigint | null;
  clientMsgId: string;
}

export class DuplicateClientMsgIdError extends Error {
  constructor(readonly clientMsgId: string) {
    super(`clientMsgId already used: ${clientMsgId}`);
    this.name = "DuplicateClientMsgIdError";
  }
}

export function toBooleanQuery(input: string): string {
  return input
    .split(/\s+/u)
    .map((term) => term.replace(/[+\-><()~*"@]/gu, ""))
    .filter((term) => term.length > 0)
    .map((term) => `+${term}*`)
    .join(" ");
}

export interface MessageRepository {
  page(options: MessagePageOptions): Promise<MessagePageResult>;
  search(options: MessageSearchOptions): Promise<MessagePageResult>;
  create(input: CreateMessageInput): Promise<MessageRow>;
  findByClientMsgId(clientMsgId: string): Promise<MessageRow | null>;
  existsInConversation(
    messageId: bigint,
    conversationId: bigint,
  ): Promise<boolean>;
  findForActor(messageId: bigint): Promise<MessageActorRow | null>;
  updateBody(messageId: bigint, body: string, at: Date): Promise<MessageRow>;
  softDelete(messageId: bigint, at: Date): Promise<MessageRow>;
  toggleReaction(
    messageId: bigint,
    userId: bigint,
    emoji: string,
  ): Promise<MessageRow>;
}

export function createMessageRepository(client: PrismaClient): MessageRepository {
  return {
    async page({ conversationId, before, limit }) {
      const rows = await client.message.findMany({
        where: {
          conversationId,
          ...(before !== null ? { id: { lt: before } } : {}),
        },
        select: messageSelect,
        orderBy: { id: "desc" },
        take: limit + 1,
      });

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const oldest = items.at(-1);

      return {
        items,
        nextCursor: hasMore && oldest !== undefined ? oldest.id : null,
      };
    },

    async search({ userId, query, before, limit }) {
      const prepared = toBooleanQuery(query);

      if (prepared === "") return { items: [], nextCursor: null };

      const rows = await client.$queryRaw<Array<{ id: bigint }>>`
        SELECT m.id AS id
        FROM messages m
        JOIN conversation_members cm
          ON cm.conversation_id = m.conversation_id AND cm.user_id = ${userId}
        WHERE MATCH(m.body) AGAINST(${prepared} IN BOOLEAN MODE)
          AND m.deleted_at IS NULL
          AND m.type <> 'SYSTEM'
          AND (${before} IS NULL OR m.id < ${before})
        ORDER BY m.id DESC
        LIMIT ${limit + 1}
      `;

      const hasMore = rows.length > limit;
      const ids = (hasMore ? rows.slice(0, limit) : rows).map((row) => row.id);

      if (ids.length === 0) return { items: [], nextCursor: null };

      const items = await client.message.findMany({
        where: { id: { in: ids } },
        select: messageSelect,
        orderBy: { id: "desc" },
      });

      return {
        items,
        nextCursor: hasMore ? (ids.at(-1) ?? null) : null,
      };
    },

    async create(input) {
      try {
        return await client.$transaction(async (tx) => {
          const message = await tx.message.create({
            data: {
              conversationId: input.conversationId,
              senderId: input.senderId,
              type: input.type,
              body: input.body,
              replyToId: input.replyToId,
              clientMsgId: input.clientMsgId,
            },
            select: messageSelect,
          });

          await tx.conversation.update({
            where: { id: input.conversationId },
            data: { lastMessageId: message.id },
          });

          await tx.conversationMember.update({
            where: {
              conversationId_userId: {
                conversationId: input.conversationId,
                userId: input.senderId,
              },
            },
            data: { lastReadMessageId: message.id },
          });

          return message;
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new DuplicateClientMsgIdError(input.clientMsgId);
        }
        throw error;
      }
    },

    async findByClientMsgId(clientMsgId) {
      return await client.message.findUnique({
        where: { clientMsgId },
        select: messageSelect,
      });
    },

    async existsInConversation(messageId, conversationId) {
      const row = await client.message.findFirst({
        where: { id: messageId, conversationId },
        select: { id: true },
      });

      return row !== null;
    },

    async findForActor(messageId) {
      return await client.message.findUnique({
        where: { id: messageId },
        select: actorSelect,
      });
    },

    async updateBody(messageId, body, at) {
      return await client.message.update({
        where: { id: messageId },
        data: { body, editedAt: at },
        select: messageSelect,
      });
    },

    async softDelete(messageId, at) {
      return await client.message.update({
        where: { id: messageId },
        data: { deletedAt: at },
        select: messageSelect,
      });
    },

    async toggleReaction(messageId, userId, emoji) {
      return await client.$transaction(async (tx) => {
        const key = { messageId_userId_emoji: { messageId, userId, emoji } };
        const existing = await tx.reaction.findUnique({ where: key });

        if (existing === null) {
          await tx.reaction.create({ data: { messageId, userId, emoji } });
        } else {
          await tx.reaction.delete({ where: key });
        }

        return await tx.message.findUniqueOrThrow({
          where: { id: messageId },
          select: messageSelect,
        });
      });
    },
  };
}
