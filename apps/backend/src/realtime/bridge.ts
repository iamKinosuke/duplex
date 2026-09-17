import { ROOM } from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { SessionEvents } from "../services/auth.service.js";
import type {
  ConversationCreatedEvent,
  ConversationEvents,
} from "../services/conversation.service.js";
import type { RealtimeServer } from "./server.js";

export interface RealtimeBridge extends ConversationEvents, SessionEvents {
  attach(io: RealtimeServer): void;
}

export function createRealtimeBridge(): RealtimeBridge {
  let io: RealtimeServer | null = null;

  return {
    attach(server) {
      io = server;
    },

    conversationCreated(event: ConversationCreatedEvent) {
      if (io === null) return;

      const room = ROOM.conversation(event.conversationId);

      for (const viewer of event.viewers) {
        const userRoom = ROOM.user(viewer.userId);

        io.in(userRoom).socketsJoin(room);
        io.to(userRoom).emit("conversation:upsert", viewer.conversation);
      }

      logger.debug("conversation broadcast", {
        conversationId: event.conversationId,
        viewers: event.viewers.length,
      });
    },

    sessionsRevoked(userId: string) {
      if (io === null) return;

      io.in(ROOM.user(userId)).disconnectSockets(true);
      logger.debug("sockets disconnected after sign-out", { userId });
    },
  };
}
