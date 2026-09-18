import {
  LIMITS,
  type ConversationDetail,
  type ConversationSummary,
  type Message,
} from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import type {
  ConversationDetailRow,
  ConversationRepository,
} from "../repositories/conversation.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { ConversationType, MemberRole } from "../generated/prisma/client.js";
import { toDetail, toSummary } from "../utils/conversation.serialize.js";
import { toMessage } from "../utils/message.serialize.js";

export interface ConversationViewerPayload {
  userId: string;
  conversation: ConversationDetail;
}

export interface ConversationCreatedEvent {
  conversationId: string;
  viewers: ConversationViewerPayload[];
}

export interface MembersAddedEvent {
  conversationId: string;
  viewers: ConversationViewerPayload[];
  joined: string[];
  systemMessage: Message;
}

export interface MemberRemovedEvent {
  conversationId: string;
  viewers: ConversationViewerPayload[];
  removed: string;
  systemMessage: Message;
}

export interface OwnerTransferredEvent {
  conversationId: string;
  viewers: ConversationViewerPayload[];
  systemMessage: Message;
}

export interface ConversationEvents {
  conversationCreated(event: ConversationCreatedEvent): void;
  membersAdded(event: MembersAddedEvent): void;
  memberRemoved(event: MemberRemovedEvent): void;
  ownerTransferred(event: OwnerTransferredEvent): void;
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

export interface CreateGroupRequest {
  ownerId: bigint;
  name: string;
  avatarUrl: string | null;
  memberIds: bigint[];
}

export interface AddMembersRequest {
  conversationId: bigint;
  actorId: bigint;
  memberIds: bigint[];
}

export interface RemoveMemberRequest {
  conversationId: bigint;
  actorId: bigint;
  memberId: bigint;
}

export interface TransferOwnerRequest {
  conversationId: bigint;
  actorId: bigint;
  nextOwnerId: bigint;
}

export interface ConversationService {
  list(userId: bigint): Promise<ConversationSummary[]>;
  detail(conversationId: bigint, userId: bigint): Promise<ConversationDetail>;
  openDirect(userId: bigint, peerId: bigint): Promise<DirectConversationResult>;
  createGroup(request: CreateGroupRequest): Promise<ConversationDetail>;
  addMembers(request: AddMembersRequest): Promise<ConversationDetail>;
  removeMember(request: RemoveMemberRequest): Promise<ConversationDetail | null>;
  transferOwner(request: TransferOwnerRequest): Promise<ConversationDetail>;
}

const NOT_FOUND = "That conversation does not exist.";

export function createConversationService(
  deps: ConversationServiceDeps,
): ConversationService {
  function viewersFor(
    row: ConversationDetailRow,
    unread: Map<bigint, number>,
  ): ConversationViewerPayload[] {
    return row.members.map((member) => ({
      userId: member.userId.toString(),
      conversation: toDetail(row, member.userId, unread.get(member.userId) ?? 0),
    }));
  }

  async function viewersWithUnread(
    row: ConversationDetailRow,
  ): Promise<ConversationViewerPayload[]> {
    const counts = await deps.conversations.unreadByMember(row.id);

    return viewersFor(
      row,
      new Map(counts.map((count) => [count.userId, count.unread])),
    );
  }

  async function memberRowOf(
    conversationId: bigint,
    userId: bigint,
  ): Promise<ConversationDetailRow> {
    const row = await deps.conversations.findForMember(conversationId, userId);

    if (row === null) {
      throw AppError.notFound(NOT_FOUND);
    }

    return row;
  }

  function requireGroup(row: ConversationDetailRow, message: string): void {
    if (row.type !== ConversationType.GROUP) {
      throw AppError.badRequest(message);
    }
  }

  function requireOwner(row: ConversationDetailRow, userId: bigint): void {
    const me = row.members.find((member) => member.userId === userId);

    if (me === undefined || me.role !== MemberRole.OWNER) {
      throw AppError.forbidden("Only the group owner can do that.");
    }
  }

  function nameOf(row: ConversationDetailRow, userId: bigint): string {
    const member = row.members.find((entry) => entry.userId === userId);
    return member?.user.displayName ?? "Someone";
  }

  function unreadOf(
    viewers: ConversationViewerPayload[],
    userId: bigint,
  ): number {
    const mine = viewers.find((viewer) => viewer.userId === userId.toString());
    return mine?.conversation.unreadCount ?? 0;
  }

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
          viewers: viewersFor(result.conversation, new Map()),
        });
      }

      return { conversation, created: result.created };
    },

    async createGroup(request) {
      const memberIds = [...new Set(request.memberIds)].filter(
        (memberId) => memberId !== request.ownerId,
      );

      if (memberIds.length === 0) {
        throw AppError.badRequest("A group needs at least one other person.");
      }

      if (memberIds.length + 1 > LIMITS.groupMembers.max) {
        throw AppError.badRequest(
          `A group holds at most ${LIMITS.groupMembers.max} people.`,
        );
      }

      const people = await deps.users.listNamesByIds([
        request.ownerId,
        ...memberIds,
      ]);

      if (people.length !== memberIds.length + 1) {
        throw AppError.notFound("Some of those people do not exist.");
      }

      const owner = people.find((person) => person.id === request.ownerId);

      const result = await deps.conversations.createGroup({
        ownerId: request.ownerId,
        name: request.name,
        avatarUrl: request.avatarUrl,
        memberIds,
        systemBody: `${owner?.displayName ?? "Someone"} created the group`,
      });

      if (deps.events !== undefined) {
        deps.events.conversationCreated({
          conversationId: result.conversation.id.toString(),
          viewers: viewersFor(result.conversation, new Map()),
        });
      }

      return toDetail(result.conversation, request.ownerId, 0);
    },

    async addMembers({ conversationId, actorId, memberIds }) {
      const row = await memberRowOf(conversationId, actorId);
      requireGroup(row, "Only a group has members to manage.");
      requireOwner(row, actorId);

      const present = new Set(row.members.map((member) => member.userId));
      const wanted = [...new Set(memberIds)].filter(
        (memberId) => !present.has(memberId),
      );

      if (wanted.length === 0) {
        throw AppError.badRequest("They are already in this group.");
      }

      if (present.size + wanted.length > LIMITS.groupMembers.max) {
        throw AppError.badRequest(
          `A group holds at most ${LIMITS.groupMembers.max} people.`,
        );
      }

      const people = await deps.users.listNamesByIds(wanted);

      if (people.length !== wanted.length) {
        throw AppError.notFound("Some of those people do not exist.");
      }

      const result = await deps.conversations.addMembers({
        conversationId,
        actorId,
        memberIds: wanted,
        systemBody: `${nameOf(row, actorId)} added ${people
          .map((person) => person.displayName)
          .join(", ")}`,
      });

      const viewers = await viewersWithUnread(result.conversation);

      if (deps.events !== undefined) {
        deps.events.membersAdded({
          conversationId: conversationId.toString(),
          viewers,
          joined: wanted.map((memberId) => memberId.toString()),
          systemMessage: toMessage(result.systemMessage),
        });
      }

      return toDetail(result.conversation, actorId, unreadOf(viewers, actorId));
    },

    async removeMember({ conversationId, actorId, memberId }) {
      const row = await memberRowOf(conversationId, actorId);
      const leaving = actorId === memberId;

      requireGroup(
        row,
        leaving
          ? "You cannot leave a direct conversation."
          : "Only a group has members to manage.",
      );

      const target = row.members.find((member) => member.userId === memberId);

      if (target === undefined) {
        throw AppError.notFound("They are not in this group.");
      }

      if (leaving) {
        if (target.role === MemberRole.OWNER) {
          throw AppError.badRequest(
            "Hand the group to someone else before you leave.",
          );
        }
      } else {
        requireOwner(row, actorId);
      }

      const actor = nameOf(row, actorId);

      const result = await deps.conversations.removeMember({
        conversationId,
        actorId,
        memberId,
        systemBody: leaving
          ? `${actor} left the group`
          : `${actor} removed ${target.user.displayName}`,
      });

      const viewers = await viewersWithUnread(result.conversation);

      if (deps.events !== undefined) {
        deps.events.memberRemoved({
          conversationId: conversationId.toString(),
          viewers,
          removed: memberId.toString(),
          systemMessage: toMessage(result.systemMessage),
        });
      }

      return leaving
        ? null
        : toDetail(result.conversation, actorId, unreadOf(viewers, actorId));
    },

    async transferOwner({ conversationId, actorId, nextOwnerId }) {
      const row = await memberRowOf(conversationId, actorId);
      requireGroup(row, "Only a group has an owner.");
      requireOwner(row, actorId);

      if (nextOwnerId === actorId) {
        throw AppError.badRequest("You already own this group.");
      }

      const target = row.members.find(
        (member) => member.userId === nextOwnerId,
      );

      if (target === undefined) {
        throw AppError.notFound("They are not in this group.");
      }

      const result = await deps.conversations.transferOwner({
        conversationId,
        currentOwnerId: actorId,
        nextOwnerId,
        systemBody: `${nameOf(row, actorId)} made ${
          target.user.displayName
        } the owner`,
      });

      const viewers = await viewersWithUnread(result.conversation);

      if (deps.events !== undefined) {
        deps.events.ownerTransferred({
          conversationId: conversationId.toString(),
          viewers,
          systemMessage: toMessage(result.systemMessage),
        });
      }

      return toDetail(result.conversation, actorId, unreadOf(viewers, actorId));
    },
  };
}
