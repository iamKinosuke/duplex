import {
  CLIENT_EVENT_SCHEMAS,
  ROOM,
  type AckFn,
  type Message,
} from "@duplex/shared";

import { AppError } from "../../errors/AppError.js";
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
}
