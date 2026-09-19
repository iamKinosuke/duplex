import type { Server as HttpServer } from "node:http";

import { createAdapter } from "@socket.io/redis-adapter";
import { Server, type Socket } from "socket.io";
import {
  ROOM,
  TIMINGS,
  toId,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";
import {
  createRateLimiter,
  ruleFromWindow,
  type RateLimitRule,
} from "../middleware/rate-limit.js";
import type { ConversationRepository } from "../repositories/conversation.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { MessageService } from "../services/message.service.js";
import { createHandshakeAuth } from "./auth.js";
import { registerMessageHandlers } from "./handlers/message.js";
import { registerTypingHandlers } from "./handlers/typing.js";
import type { PresenceTracker } from "./presence.js";
import { createTypingTracker } from "./typing.js";

type InterServerEvents = Record<string, never>;

const TYPING_EVENTS_MAX = 15;
const TYPING_EVENTS_WINDOW_MS = 10_000;

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface RealtimeServerDeps {
  httpServer: HttpServer;
  redis: RedisClients;
  users: Pick<UserRepository, "existsById" | "touchLastSeen">;
  conversations: Pick<ConversationRepository, "idsForUser" | "peerIdsIn">;
  messages: MessageService;
  presence: PresenceTracker;
  secret: string;
  frontendOrigin: string;
  adapterKey: string;
  sendRateLimit: { max: number; windowMs: number };
}

export function createRealtimeServer(deps: RealtimeServerDeps): RealtimeServer {
  const io: RealtimeServer = new Server(deps.httpServer, {
    serveClient: false,
    cors: { origin: deps.frontendOrigin, credentials: true },
  });

  io.adapter(
    createAdapter(deps.redis.pub, deps.redis.sub, { key: deps.adapterKey }),
  );

  const presence = deps.presence;
  const typing = createTypingTracker(deps.redis);
  const limiter = createRateLimiter(deps.redis);
  const sendRule: RateLimitRule = ruleFromWindow(
    deps.sendRateLimit.max,
    deps.sendRateLimit.windowMs,
  );
  const typingRule: RateLimitRule = ruleFromWindow(
    TYPING_EVENTS_MAX,
    TYPING_EVENTS_WINDOW_MS,
  );

  io.use(createHandshakeAuth({ secret: deps.secret, users: deps.users }));

  io.on("connection", (socket) => {
    registerMessageHandlers(socket, {
      io,
      messages: deps.messages,
      typing,
      limiter,
      sendRule,
    });

    registerTypingHandlers(socket, { io, typing, limiter, typingRule });

    void welcome(socket);
  });

  const sweep = setInterval(() => {
    void refreshPresence();
  }, TIMINGS.presenceSweepMs);

  sweep.unref();

  async function refreshPresence(): Promise<void> {
    try {
      const sockets = await io.local.fetchSockets();
      if (sockets.length === 0) return;

      const restored = await presence.refresh(
        sockets.map((socket) => ({
          userId: socket.data.userId,
          socketId: socket.id,
        })),
      );

      if (restored.length === 0) return;

      const announced = new Set<string>();

      for (const socket of sockets) {
        const userId = socket.data.userId;

        if (!restored.includes(userId) || announced.has(userId)) continue;
        announced.add(userId);

        const rooms = [...socket.rooms].filter((room) =>
          room.startsWith("conv:"),
        );
        if (rooms.length === 0) continue;

        io.to(rooms).emit("presence:update", {
          userId: toId(userId),
          status: "online",
          lastSeenAt: null,
        });
      }

      logger.warn("presence was lost and has been restored", {
        users: restored.length,
      });
    } catch (error) {
      logger.error("presence sweep failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function welcome(socket: RealtimeSocket): Promise<void> {
    const userId = socket.data.userId;
    let rooms: string[] = [];

    try {
      await socket.join(ROOM.user(userId));

      const firstConnection = await presence.online(userId, socket.id);

      const conversationIds = await deps.conversations.idsForUser(
        BigInt(userId),
      );
      rooms = conversationIds.map((id) => ROOM.conversation(id.toString()));

      if (rooms.length > 0) await socket.join(rooms);

      if (firstConnection && rooms.length > 0) {
        socket.to(rooms).emit("presence:update", {
          userId: toId(userId),
          status: "online",
          lastSeenAt: null,
        });
      }

      const peerIds = await deps.conversations.peerIdsIn(
        conversationIds,
        BigInt(userId),
      );
      const onlinePeers = await presence.onlineAmong(
        peerIds.map((id) => id.toString()),
      );

      for (const peerId of onlinePeers) {
        socket.emit("presence:update", {
          userId: toId(peerId),
          status: "online",
          lastSeenAt: null,
        });
      }

      logger.info("socket connected", {
        userId,
        socketId: socket.id,
        conversations: conversationIds.length,
        onlinePeers: onlinePeers.length,
        transport: socket.conn.transport.name,
      });
    } catch (error) {
      logger.error("socket setup failed", {
        userId,
        socketId: socket.id,
        error: error instanceof Error ? error.message : String(error),
      });
      socket.disconnect(true);
      return;
    }

    socket.on("disconnect", (reason) => {
      void (async () => {
        const lastConnection = await presence.offline(userId, socket.id);

        if (lastConnection) {
          const at = new Date();
          await deps.users.touchLastSeen(BigInt(userId), at);

          if (rooms.length > 0) {
            io.to(rooms).emit("presence:update", {
              userId: toId(userId),
              status: "offline",
              lastSeenAt: at.toISOString(),
            });
          }
        }

        logger.debug("socket disconnected", {
          userId,
          socketId: socket.id,
          reason,
          lastConnection,
        });
      })();
    });
  }

  return io;
}
