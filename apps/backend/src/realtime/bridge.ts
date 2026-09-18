import { ROOM, toId } from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { SessionEvents } from "../services/auth.service.js";
import type {
  ConversationCreatedEvent,
  ConversationEvents,
} from "../services/conversation.service.js";
import type { PresenceTracker } from "./presence.js";
import type { RealtimeServer } from "./server.js";

export interface RealtimeBridge extends ConversationEvents, SessionEvents {
  attach(io: RealtimeServer, presence: PresenceTracker): void;
}

export function createRealtimeBridge(): RealtimeBridge {
  let io: RealtimeServer | null = null;
  let presence: PresenceTracker | null = null;

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
        const userRoom = ROOM.user(viewer.userId);

        server.in(userRoom).socketsJoin(room);
        server.to(userRoom).emit("conversation:upsert", viewer.conversation);
      }

      logger.debug("conversation broadcast", {
        conversationId: event.conversationId,
        viewers: event.viewers.length,
      });

      const tracker = presence;
      if (tracker === null) return;

      void (async () => {
        const memberIds = event.viewers.map((viewer) => viewer.userId);
        const online = await tracker.onlineAmong(memberIds);

        for (const memberId of online) {
          server.to(room).emit("presence:update", {
            userId: toId(memberId),
            status: "online",
            lastSeenAt: null,
          });
        }
      })();
    },

    sessionsRevoked(userId: string) {
      if (io === null) return;

      io.in(ROOM.user(userId)).disconnectSockets(true);
      logger.debug("sockets disconnected after sign-out", { userId });
    },
  };
}
