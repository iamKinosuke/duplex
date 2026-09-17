import type { ConversationDetail, ConversationSummary } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import type {
  ConversationDetailRow,
  ConversationRepository,
} from "../repositories/conversation.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { toDetail, toSummary } from "../utils/conversation.serialize.js";

export interface ConversationViewerPayload {
  userId: string;
  conversation: ConversationDetail;
}

export interface ConversationCreatedEvent {
  conversationId: string;
  viewers: ConversationViewerPayload[];
}

export interface ConversationEvents {
  conversationCreated(event: ConversationCreatedEvent): void;
}

export interface ConversationServiceDeps {
  conversations: ConversationRepository;
  users: UserRepository;
  events?: ConversationEvents | undefined;
}

export interface DirectConversationResult {
  conversation: ConversationDetail;
  created: boolean;
}

export interface ConversationService {
  list(userId: bigint): Promise<ConversationSummary[]>;
  detail(conversationId: bigint, userId: bigint): Promise<ConversationDetail>;
  openDirect(userId: bigint, peerId: bigint): Promise<DirectConversationResult>;
}

const NOT_FOUND = "That conversation does not exist.";

export function createConversationService(
  deps: ConversationServiceDeps,
): ConversationService {
  async function detailFor(
    row: ConversationDetailRow,
    userId: bigint,
  ): Promise<ConversationDetail> {
    const me = row.members.find((member) => member.userId === userId);

    const unread =
      me === undefined
        ? 0
        : await deps.conversations.unreadCountIn(
            row.id,
            userId,
            me.lastReadMessageId,
          );

    return toDetail(row, userId, unread);
  }

  return {
    async list(userId) {
      const [memberships, unread] = await Promise.all([
        deps.conversations.listForUser(userId),
        deps.conversations.unreadCountsFor(userId),
      ]);

      const unreadByConversation = new Map(
        unread.map((row) => [row.conversationId, row.unread]),
      );

      return memberships.map((membership) =>
        toSummary(
          membership,
          userId,
          unreadByConversation.get(membership.conversation.id) ?? 0,
        ),
      );
    },

    async detail(conversationId, userId) {
      const row = await deps.conversations.findForMember(conversationId, userId);

      if (row === null) {
        throw AppError.notFound(NOT_FOUND);
      }

      return await detailFor(row, userId);
    },

    async openDirect(userId, peerId) {
      if (peerId === userId) {
        throw AppError.badRequest("You cannot start a conversation with yourself.");
      }

      if (!(await deps.users.existsById(peerId))) {
        throw AppError.notFound("That person does not exist.");
      }

      const result = await deps.conversations.createDirect(userId, peerId);
      const conversation = await detailFor(result.conversation, userId);

      if (result.created && deps.events !== undefined) {
        deps.events.conversationCreated({
          conversationId: conversation.id,
          viewers: result.conversation.members.map((member) => ({
            userId: member.userId.toString(),
            conversation: toDetail(result.conversation, member.userId, 0),
          })),
        });
      }

      return { conversation, created: result.created };
    },
  };
}
