import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env, databaseLabel } from "./config/env.js";
import { assertDatabaseReachable, disconnectDatabase, prisma } from "./db/prisma.js";
import { logger } from "./lib/logger.js";
import { connectRedis, createRedisClients } from "./lib/redis.js";
import { createRealtimeBridge } from "./realtime/bridge.js";
import { createPresenceTracker } from "./realtime/presence.js";
import { createRealtimeServer } from "./realtime/server.js";
import { createConversationRepository } from "./repositories/conversation.repository.js";
import { createMessageRepository } from "./repositories/message.repository.js";
import { createUserRepository } from "./repositories/user.repository.js";
import { createMessageService } from "./services/message.service.js";

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function main(): Promise<void> {
  logger.info("connecting to database", { database: databaseLabel });
  await assertDatabaseReachable();
  logger.info("database ready", { database: databaseLabel });

  const redis = createRedisClients();
  await connectRedis(redis);

  const presence = createPresenceTracker(redis);
  const bridge = createRealtimeBridge();

  const app = createApp({
    redis,
    conversationEvents: bridge,
    sessionEvents: bridge,
  });
  const server = createServer(app);

  const conversationRepository = createConversationRepository(prisma);

  const io = createRealtimeServer({
    httpServer: server,
    redis,
    users: createUserRepository(prisma),
    conversations: conversationRepository,
    presence,
    messages: createMessageService({
      messages: createMessageRepository(prisma),
      conversations: conversationRepository,
    }),
    secret: env.JWT_SECRET,
    frontendOrigin: env.FRONTEND_ORIGIN,
    adapterKey: `${env.REDIS_PREFIX}socket.io`,
    sendRateLimit: {
      max: env.RATE_LIMIT_MESSAGE_MAX,
      windowMs: env.RATE_LIMIT_MESSAGE_WINDOW_MS,
    },
  });

  bridge.attach(io, presence);

  server.listen(env.PORT, () => {
    logger.info("api listening", {
      url: `http://localhost:${env.PORT}`,
      env: env.NODE_ENV,
      pid: process.pid,
      socket: "/socket.io",
    });
  });

  let shuttingDown = false;

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;

      logger.info("shutting down", { signal });

      const forceExit = setTimeout(() => {
        logger.error("shutdown timed out, exiting");
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      forceExit.unref();

      io.close(() => {
        void (async () => {
          await Promise.allSettled([disconnectDatabase(), redis.close()]);
          clearTimeout(forceExit);
          process.exit(0);
        })();
      });
    });
  }
}

main().catch((error: unknown) => {
  logger.error("failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
