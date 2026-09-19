import { CLIENT_EVENT_SCHEMAS, ROOM, toId } from "@duplex/shared";

import { logger } from "../../lib/logger.js";
import type { RateLimiter, RateLimitRule } from "../../middleware/rate-limit.js";
import type { RealtimeServer, RealtimeSocket } from "../server.js";
import type { TypingTracker } from "../typing.js";

export interface TypingHandlerDeps {
  io: RealtimeServer;
  typing: TypingTracker;
  limiter: RateLimiter;
  typingRule: RateLimitRule;
}

type TypingSignal = "typing:start" | "typing:stop";

export function registerTypingHandlers(
  socket: RealtimeSocket,
  deps: TypingHandlerDeps,
): void {
  const userId = socket.data.userId;

  async function signal(kind: TypingSignal, payload: unknown): Promise<void> {
    try {
      const event = CLIENT_EVENT_SCHEMAS[kind].parse(payload);
      const room = ROOM.conversation(event.conversationId);

      if (!socket.rooms.has(room)) return;

      const allowed = await deps.limiter.consume(
        `rl:socket:typing:${userId}`,
        deps.typingRule,
      );

      if (!allowed.allowed) return;

      const userIds =
        kind === "typing:start"
          ? await deps.typing.start(event.conversationId, userId)
          : await deps.typing.stop(event.conversationId, userId);

      deps.io.to(room).emit("typing:update", {
        conversationId: event.conversationId,
        userIds: userIds.map(toId),
      });
    } catch (error) {
      logger.debug("typing ignored", {
        userId,
        kind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  socket.on("typing:start", (payload) => {
    void signal("typing:start", payload);
  });

  socket.on("typing:stop", (payload) => {
    void signal("typing:stop", payload);
  });
}
