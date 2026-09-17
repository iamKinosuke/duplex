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
} satisfies Prisma.MessageSelect;

export type MessageRow = Prisma.MessageGetPayload<{
  select: typeof messageSelect;
}>;

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

export interface MessageRepository {
  page(options: MessagePageOptions): Promise<MessagePageResult>;
  create(input: CreateMessageInput): Promise<MessageRow>;
  findByClientMsgId(clientMsgId: string): Promise<MessageRow | null>;
  existsInConversation(
    messageId: bigint,
    conversationId: bigint,
  ): Promise<boolean>;
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
  };
}
