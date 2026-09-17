import type { Server as HttpServer } from "node:http";

import { createAdapter } from "@socket.io/redis-adapter";
import { Server, type Socket } from "socket.io";
import {
  ROOM,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";
import type { ConversationRepository } from "../repositories/conversation.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { createHandshakeAuth } from "./auth.js";

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
  users: Pick<UserRepository, "existsById">;
  conversations: Pick<ConversationRepository, "idsForUser">;
  secret: string;
  frontendOrigin: string;
  adapterKey: string;
}

export function createRealtimeServer(deps: RealtimeServerDeps): RealtimeServer {
  const io: RealtimeServer = new Server(deps.httpServer, {
    serveClient: false,
    cors: { origin: deps.frontendOrigin, credentials: true },
  });

  io.adapter(
    createAdapter(deps.redis.pub, deps.redis.sub, { key: deps.adapterKey }),
  );

  io.use(createHandshakeAuth({ secret: deps.secret, users: deps.users }));

  io.on("connection", (socket) => {
    void welcome(socket);
  });

  async function welcome(socket: RealtimeSocket): Promise<void> {
    const userId = socket.data.userId;

    try {
      await socket.join(ROOM.user(userId));

      const conversationIds = await deps.conversations.idsForUser(
        BigInt(userId),
      );

      if (conversationIds.length > 0) {
        await socket.join(
          conversationIds.map((id) => ROOM.conversation(id.toString())),
        );
      }

      logger.info("socket connected", {
        userId,
        socketId: socket.id,
        conversations: conversationIds.length,
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
      logger.debug("socket disconnected", {
        userId,
        socketId: socket.id,
        reason,
      });
    });
  }

  return io;
}
