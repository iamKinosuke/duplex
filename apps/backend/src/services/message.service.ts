import type {
  Message,
  MessageEdited,
  MessagePage,
  MessageType,
  ReactionEmoji,
  ReactionGroup,
} from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import type { ConversationRepository } from "../repositories/conversation.repository.js";
import {
  DuplicateClientMsgIdError,
  type MessageRepository,
} from "../repositories/message.repository.js";
import { MessageType as PrismaMessageType } from "../generated/prisma/client.js";
import {
  fromMessageType,
  toMessage,
  toReactionGroups,
} from "../utils/message.serialize.js";
import { id, iso } from "../utils/serialize.js";

export interface MessageServiceDeps {
  messages: MessageRepository;
  conversations: ConversationRepository;
}

export interface SearchRequest {
  userId: bigint;
  query: string;
  before: bigint | null;
  limit: number;
}

export interface PageRequest {
  conversationId: bigint;
  userId: bigint;
  before: bigint | null;
  limit: number;
}

export interface SendRequest {
  conversationId: bigint;
  senderId: bigint;
  clientMsgId: string;
  type: MessageType;
  body: string | null;
  replyToId: bigint | null;
  attachmentKeys: string[];
}

export interface SendResult {
  message: Message;
  created: boolean;
}

export interface MarkReadRequest {
  conversationId: bigint;
  userId: bigint;
  lastMessageId: bigint;
}

export interface EditRequest {
  messageId: bigint;
  userId: bigint;
  body: string;
}

export interface EditResult {
  message: Message;
  edited: MessageEdited;
}

export interface RemoveRequest {
  messageId: bigint;
  userId: bigint;
}

export interface RemoveResult {
  conversationId: string;
  messageId: string;
  deletedAt: string;
  changed: boolean;
}

export interface ReactionRequest {
  messageId: bigint;
  userId: bigint;
  emoji: ReactionEmoji;
}

export interface ReactionResult {
  message: Message;
  conversationId: string;
  reactions: ReactionGroup[];
}

export interface MessageService {
  page(request: PageRequest): Promise<MessagePage>;
  search(request: SearchRequest): Promise<MessagePage>;
  send(request: SendRequest): Promise<SendResult>;
  markRead(request: MarkReadRequest): Promise<boolean>;
  edit(request: EditRequest): Promise<EditResult>;
  remove(request: RemoveRequest): Promise<RemoveResult>;
  react(request: ReactionRequest): Promise<ReactionResult>;
}

const NOT_FOUND = "That conversation does not exist.";
const MESSAGE_NOT_FOUND = "That message does not exist.";

export function createMessageService(deps: MessageServiceDeps): MessageService {
  async function assertMember(
    conversationId: bigint,
    userId: bigint,
  ): Promise<void> {
    const membership = await deps.conversations.membershipOf(
      conversationId,
      userId,
    );

    if (membership === null) {
      throw AppError.notFound(NOT_FOUND);
    }
  }

  async function mineOrFail(messageId: bigint, userId: bigint) {
    const row = await deps.messages.findForActor(messageId);

    if (row === null) {
      throw AppError.notFound(MESSAGE_NOT_FOUND);
    }

    await assertMember(row.conversationId, userId);

    if (row.senderId !== userId) {
      throw AppError.forbidden("You can only change your own messages.");
    }

    if (row.type === PrismaMessageType.SYSTEM) {
      throw AppError.badRequest("System messages cannot be changed.");
    }

    return row;
  }

  return {
    async page({ conversationId, userId, before, limit }) {
      await assertMember(conversationId, userId);

      const result = await deps.messages.page({ conversationId, before, limit });

      return {
        items: result.items.map((row) => toMessage(row, userId)),
        nextCursor: result.nextCursor === null ? null : id(result.nextCursor),
      };
    },

    async search({ userId, query, before, limit }) {
      const result = await deps.messages.search({
        userId,
        query,
        before,
        limit,
      });

      return {
        items: result.items.map((row) => toMessage(row, userId)),
        nextCursor: result.nextCursor === null ? null : id(result.nextCursor),
      };
    },

    async markRead({ conversationId, userId, lastMessageId }) {
      await assertMember(conversationId, userId);

      return await deps.conversations.markRead(
        conversationId,
        userId,
        lastMessageId,
      );
    },

    async send(request) {
      await assertMember(request.conversationId, request.senderId);

      if (request.attachmentKeys.length > 0) {
        throw AppError.badRequest("Attachments arrive in a later phase.");
      }

      if (request.replyToId !== null) {
        const sameRoom = await deps.messages.existsInConversation(
          request.replyToId,
          request.conversationId,
        );

        if (!sameRoom) {
          throw AppError.badRequest(
            "You can only reply to a message in this conversation.",
          );
        }
      }

      try {
        const row = await deps.messages.create({
          conversationId: request.conversationId,
          senderId: request.senderId,
          type: fromMessageType(request.type),
          body: request.body,
          replyToId: request.replyToId,
          clientMsgId: request.clientMsgId,
        });

        return { message: toMessage(row, request.senderId), created: true };
      } catch (error) {
        if (!(error instanceof DuplicateClientMsgIdError)) throw error;

        const existing = await deps.messages.findByClientMsgId(
          request.clientMsgId,
        );

        if (
          existing === null ||
          existing.senderId !== request.senderId ||
          existing.conversationId !== request.conversationId
        ) {
          throw AppError.conflict("That message id is already in use.");
        }

        return { message: toMessage(existing, request.senderId), created: false };
      }
    },

    async edit({ messageId, userId, body }) {
      const row = await mineOrFail(messageId, userId);

      if (row.deletedAt !== null) {
        throw AppError.badRequest("That message was deleted.");
      }

      const at = new Date();
      const updated = await deps.messages.updateBody(messageId, body, at);

      return {
        message: toMessage(updated, userId),
        edited: {
          conversationId: id(row.conversationId),
          messageId: id(messageId),
          body,
          editedAt: iso(at),
        },
      };
    },

    async remove({ messageId, userId }) {
      const row = await mineOrFail(messageId, userId);

      if (row.deletedAt !== null) {
        return {
          conversationId: id(row.conversationId),
          messageId: id(messageId),
          deletedAt: iso(row.deletedAt),
          changed: false,
        };
      }

      const at = new Date();
      await deps.messages.softDelete(messageId, at);

      return {
        conversationId: id(row.conversationId),
        messageId: id(messageId),
        deletedAt: iso(at),
        changed: true,
      };
    },

    async react({ messageId, userId, emoji }) {
      const row = await deps.messages.findForActor(messageId);

      if (row === null) {
        throw AppError.notFound(MESSAGE_NOT_FOUND);
      }

      await assertMember(row.conversationId, userId);

      if (row.deletedAt !== null) {
        throw AppError.badRequest("You cannot react to a deleted message.");
      }

      if (row.type === PrismaMessageType.SYSTEM) {
        throw AppError.badRequest("You cannot react to a system message.");
      }

      const updated = await deps.messages.toggleReaction(
        messageId,
        userId,
        emoji,
      );

      return {
        message: toMessage(updated, userId),
        conversationId: id(row.conversationId),
        reactions: toReactionGroups(updated.reactions),
      };
    },
  };
}
