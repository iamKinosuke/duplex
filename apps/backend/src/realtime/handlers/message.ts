import {
  CLIENT_EVENT_SCHEMAS,
  ROOM,
  toId,
  type AckFn,
  type Message,
} from "@duplex/shared";

import { AppError } from "../../errors/AppError.js";
import { logger } from "../../lib/logger.js";
import type { RateLimiter, RateLimitRule } from "../../middleware/rate-limit.js";
import type { MessageService } from "../../services/message.service.js";
import { toBigInt } from "../../utils/serialize.js";
import { failure, success } from "../ack.js";
import type { RealtimeServer, RealtimeSocket } from "../server.js";

export interface MessageHandlerDeps {
  io: RealtimeServer;
  messages: MessageService;
  limiter: RateLimiter;
  sendRule: RateLimitRule;
}

export function registerMessageHandlers(
  socket: RealtimeSocket,
  deps: MessageHandlerDeps,
): void {
  const userId = socket.data.userId;

  socket.on("message:send", (payload, ack: AckFn<Message>) => {
    void (async () => {
      try {
        const allowed = await deps.limiter.consume(
          `rl:socket:send:${userId}`,
          deps.sendRule,
        );

        if (!allowed.allowed) {
          throw AppError.rateLimited(
            `You are sending too fast. Try again in ${Math.max(
              1,
              Math.ceil(allowed.retryAfterMs / 1000),
            )}s.`,
          );
        }

        const event = CLIENT_EVENT_SCHEMAS["message:send"].parse(payload);

        const result = await deps.messages.send({
          conversationId: toBigInt(event.conversationId),
          senderId: toBigInt(userId),
          clientMsgId: event.clientMsgId,
          type: event.type,
          body: event.body ?? null,
          replyToId:
            event.replyToId === null || event.replyToId === undefined
              ? null
              : toBigInt(event.replyToId),
          attachmentKeys: event.attachmentKeys,
        });

        if (result.created) {
          deps.io
            .to(ROOM.conversation(event.conversationId))
            .emit("message:new", result.message);
        }

        ack(success(result.message));
      } catch (error) {
        ack(failure(error));
      }
    })();
  });

  socket.on("read:ack", (payload) => {
    void (async () => {
      try {
        const event = CLIENT_EVENT_SCHEMAS["read:ack"].parse(payload);

        const advanced = await deps.messages.markRead({
          conversationId: toBigInt(event.conversationId),
          userId: toBigInt(userId),
          lastMessageId: toBigInt(event.lastMessageId),
        });

        if (!advanced) return;

        deps.io.to(ROOM.conversation(event.conversationId)).emit("read:update", {
          conversationId: event.conversationId,
          userId: toId(userId),
          lastMessageId: event.lastMessageId,
        });
      } catch (error) {
        logger.debug("read:ack ignored", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });
}
