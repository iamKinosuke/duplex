import { CLIENT_EVENT_SCHEMAS, ROOM, toId, type AckFn } from "@duplex/shared";

import { AppError } from "../../errors/AppError.js";
import { logger } from "../../lib/logger.js";
import type { RateLimiter, RateLimitRule } from "../../middleware/rate-limit.js";
import type { CallClosed, CallService } from "../../services/call.service.js";
import { failure, success } from "../ack.js";
import type { RealtimeServer, RealtimeSocket } from "../server.js";

export interface CallHandlerDeps {
  io: RealtimeServer;
  calls: CallService;
  limiter: RateLimiter;
  callRule: RateLimitRule;
}

export function announceClosed(
  io: RealtimeServer,
  closed: CallClosed,
): void {
  for (const userId of [closed.record.callerId, closed.record.calleeId]) {
    io.to(ROOM.user(userId)).emit("call:ended", {
      callId: closed.record.callId,
      status: closed.status,
    });
  }

  io.to(ROOM.conversation(closed.record.conversationId)).emit(
    "message:new",
    closed.systemMessage,
  );
}

export function registerCallHandlers(
  socket: RealtimeSocket,
  deps: CallHandlerDeps,
): void {
  const userId = socket.data.userId;

  async function guard(): Promise<void> {
    const allowed = await deps.limiter.consume(
      `rl:socket:call:${userId}`,
      deps.callRule,
    );

    if (!allowed.allowed) {
      throw AppError.rateLimited("You are placing calls too fast.");
    }
  }

  function quietly(name: string, run: () => Promise<void>): void {
    void run().catch((error: unknown) => {
      logger.debug("call event ignored", {
        name,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  socket.on("call:invite", (payload, ack: AckFn<{ callId: string }>) => {
    void (async () => {
      try {
        await guard();

        const event = CLIENT_EVENT_SCHEMAS["call:invite"].parse(payload);

        const result = await deps.calls.invite({
          callerId: BigInt(userId),
          conversationId: BigInt(event.conversationId),
          kind: event.kind,
        });

        if (result.outcome === "ringing") {
          deps.io
            .to(ROOM.user(result.record.calleeId))
            .emit("call:incoming", {
              callId: result.record.callId,
              conversationId: toId(result.record.conversationId),
              callerId: toId(result.record.callerId),
              kind: result.record.kind,
            });

          ack(success({ callId: result.record.callId }));
          return;
        }

        if (result.closed !== null) announceClosed(deps.io, result.closed);

        ack(
          failure(
            result.status === "busy"
              ? AppError.conflict("They are on another call.")
              : AppError.notFound("They are not online right now."),
          ),
        );
      } catch (error) {
        ack(failure(error));
      }
    })();
  });

  socket.on("call:accept", (payload) => {
    quietly("call:accept", async () => {
      const event = CLIENT_EVENT_SCHEMAS["call:accept"].parse(payload);
      const record = await deps.calls.accept(event.callId, userId);

      for (const id of [record.callerId, record.calleeId]) {
        deps.io
          .to(ROOM.user(id))
          .emit("call:accepted", { callId: record.callId });
      }
    });
  });

  socket.on("call:decline", (payload) => {
    quietly("call:decline", async () => {
      const event = CLIENT_EVENT_SCHEMAS["call:decline"].parse(payload);
      const closed = await deps.calls.decline(event.callId, userId);

      if (closed !== null) announceClosed(deps.io, closed);
    });
  });

  socket.on("call:hangup", (payload) => {
    quietly("call:hangup", async () => {
      const event = CLIENT_EVENT_SCHEMAS["call:hangup"].parse(payload);
      const closed = await deps.calls.hangUp(event.callId, userId);

      if (closed !== null) announceClosed(deps.io, closed);
    });
  });

  socket.on("call:sdp", (payload) => {
    quietly("call:sdp", async () => {
      const event = CLIENT_EVENT_SCHEMAS["call:sdp"].parse(payload);
      const record = await deps.calls.relay(event.callId, userId);

      const peer =
        record.callerId === userId ? record.calleeId : record.callerId;

      deps.io.to(ROOM.user(peer)).emit("call:sdp", event);
    });
  });

  socket.on("call:ice", (payload) => {
    quietly("call:ice", async () => {
      const event = CLIENT_EVENT_SCHEMAS["call:ice"].parse(payload);
      const record = await deps.calls.relay(event.callId, userId);

      const peer =
        record.callerId === userId ? record.calleeId : record.callerId;

      deps.io.to(ROOM.user(peer)).emit("call:ice", event);
    });
  });
}
