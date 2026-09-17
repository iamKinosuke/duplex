import { Prisma, type PrismaClient } from "../generated/prisma/client.js";

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

export interface MessageRepository {
  page(options: MessagePageOptions): Promise<MessagePageResult>;
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
  };
}
