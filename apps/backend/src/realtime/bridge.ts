import { ROOM, toId, type Message } from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { SessionEvents } from "../services/auth.service.js";
import type {
  ConversationCreatedEvent,
  ConversationEvents,
  ConversationViewerPayload,
  MemberRemovedEvent,
  MembersAddedEvent,
  OwnerTransferredEvent,
} from "../services/conversation.service.js";
import type { PresenceTracker } from "./presence.js";
import type { RealtimeServer } from "./server.js";

export interface RealtimeBridge extends ConversationEvents, SessionEvents {
  attach(io: RealtimeServer, presence: PresenceTracker): void;
}

export function createRealtimeBridge(): RealtimeBridge {
  let io: RealtimeServer | null = null;
  let presence: PresenceTracker | null = null;

  function announce(
    conversationId: string,
    viewers: ConversationViewerPayload[],
    systemMessage: Message | null,
  ): void {
    const server = io;
    if (server === null) return;

    for (const viewer of viewers) {
      server
        .to(ROOM.user(viewer.userId))
        .emit("conversation:upsert", viewer.conversation);
    }

    if (systemMessage !== null) {
      server
        .to(ROOM.conversation(conversationId))
        .emit("message:new", systemMessage);
    }
  }

  function announceOnline(conversationId: string, userIds: string[]): void {
    const server = io;
    const tracker = presence;
    if (server === null || tracker === null || userIds.length === 0) return;

    void (async () => {
      const online = await tracker.onlineAmong(userIds);

      for (const userId of online) {
        server.to(ROOM.conversation(conversationId)).emit("presence:update", {
          userId: toId(userId),
          status: "online",
          lastSeenAt: null,
        });
      }
    })();
  }

  return {
    attach(server, tracker) {
      io = server;
      presence = tracker;
    },

    conversationCreated(event: ConversationCreatedEvent) {
      const server = io;
      if (server === null) return;

      const room = ROOM.conversation(event.conversationId);

      for (const viewer of event.viewers) {
        server.in(ROOM.user(viewer.userId)).socketsJoin(room);
      }

      announce(event.conversationId, event.viewers, null);

      logger.debug("conversation broadcast", {
        conversationId: event.conversationId,
        viewers: event.viewers.length,
      });

      announceOnline(
        event.conversationId,
        event.viewers.map((viewer) => viewer.userId),
      );
    },

    membersAdded(event: MembersAddedEvent) {
      const server = io;
      if (server === null) return;

      const room = ROOM.conversation(event.conversationId);

      for (const userId of event.joined) {
        server.in(ROOM.user(userId)).socketsJoin(room);
      }

      announce(event.conversationId, event.viewers, event.systemMessage);

      logger.debug("members added", {
        conversationId: event.conversationId,
        joined: event.joined.length,
      });

      announceOnline(
        event.conversationId,
        event.viewers.map((viewer) => viewer.userId),
      );
    },

    memberRemoved(event: MemberRemovedEvent) {
      const server = io;
      if (server === null) return;

      const room = ROOM.conversation(event.conversationId);
      const userRoom = ROOM.user(event.removed);

      server.in(userRoom).socketsLeave(room);
      server
        .to(userRoom)
        .emit("conversation:removed", {
          conversationId: toId(event.conversationId),
        });

      announce(event.conversationId, event.viewers, event.systemMessage);

      logger.debug("member removed", {
        conversationId: event.conversationId,
        userId: event.removed,
      });
    },

    ownerTransferred(event: OwnerTransferredEvent) {
      announce(event.conversationId, event.viewers, event.systemMessage);

      logger.debug("owner transferred", {
        conversationId: event.conversationId,
      });
    },

    sessionsRevoked(userId: string) {
      if (io === null) return;

      io.in(ROOM.user(userId)).disconnectSockets(true);
      logger.debug("sockets disconnected after sign-out", { userId });
    },
  };
}
