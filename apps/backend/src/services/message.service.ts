import type { MessagePage } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import type { ConversationRepository } from "../repositories/conversation.repository.js";
import type { MessageRepository } from "../repositories/message.repository.js";
import { toMessage } from "../utils/message.serialize.js";
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

export interface MessageService {
  page(request: PageRequest): Promise<MessagePage>;
}

export function createMessageService(deps: MessageServiceDeps): MessageService {
  return {
    async page({ conversationId, userId, before, limit }) {
      const membership = await deps.conversations.membershipOf(
        conversationId,
        userId,
      );

      if (membership === null) {
        throw AppError.notFound("That conversation does not exist.");
      }

      const result = await deps.messages.page({ conversationId, before, limit });

      return {
        items: result.items.map(toMessage),
        nextCursor: result.nextCursor === null ? null : id(result.nextCursor),
      };
    },
  };
}
