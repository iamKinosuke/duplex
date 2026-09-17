import type { Message, MessagePage, MessageType } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import type { ConversationRepository } from "../repositories/conversation.repository.js";
import {
  DuplicateClientMsgIdError,
  type MessageRepository,
} from "../repositories/message.repository.js";
import { fromMessageType, toMessage } from "../utils/message.serialize.js";
import { id } from "../utils/serialize.js";

export interface MessageServiceDeps {
  messages: MessageRepository;
  conversations: ConversationRepository;
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

export interface MessageService {
  page(request: PageRequest): Promise<MessagePage>;
  send(request: SendRequest): Promise<SendResult>;
}

const NOT_FOUND = "That conversation does not exist.";

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

  return {
    async page({ conversationId, userId, before, limit }) {
      await assertMember(conversationId, userId);

      const result = await deps.messages.page({ conversationId, before, limit });

      return {
        items: result.items.map(toMessage),
        nextCursor: result.nextCursor === null ? null : id(result.nextCursor),
      };
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

        return { message: toMessage(row), created: true };
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

        return { message: toMessage(existing), created: false };
      }
    },
  };
}
