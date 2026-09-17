import type { Server as HttpServer } from "node:http";

import { createAdapter } from "@socket.io/redis-adapter";
import { Server, type Socket } from "socket.io";
import {
  ROOM,
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
import { createPresenceTracker } from "./presence.js";

type InterServerEvents = Record<string, never>;

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

  const presence = createPresenceTracker(deps.redis);
  const limiter = createRateLimiter(deps.redis);
  const sendRule: RateLimitRule = ruleFromWindow(
    deps.sendRateLimit.max,
    deps.sendRateLimit.windowMs,
  );

  io.use(createHandshakeAuth({ secret: deps.secret, users: deps.users }));

  io.on("connection", (socket) => {
    void welcome(socket);
  });

  async function welcome(socket: RealtimeSocket): Promise<void> {
    const userId = socket.data.userId;
    let rooms: string[] = [];

    try {
      await socket.join(ROOM.user(userId));

      const conversationIds = await deps.conversations.idsForUser(
        BigInt(userId),
      );
      rooms = conversationIds.map((id) => ROOM.conversation(id.toString()));

      if (rooms.length > 0) await socket.join(rooms);

      const firstConnection = await presence.online(userId, socket.id);

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

    registerMessageHandlers(socket, {
      io,
      messages: deps.messages,
      limiter,
      sendRule,
    });

    socket.on("presence:heartbeat", () => {
      void presence.heartbeat(userId);
    });

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
