import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { logger } from "./logger.js";

export interface RedisClients {
  readonly commands: Redis;
  readonly pub: Redis;
  readonly sub: Redis;
  isReady(): boolean;
  close(): Promise<void>;
}

function connect(role: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    keyPrefix: env.REDIS_PREFIX,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  });

  client.on("error", (error: Error) => {
    logger.error("redis error", { role, error: error.message });
  });

  client.on("ready", () => {
    logger.info("redis ready", { role });
  });

  return client;
}

export function createRedisClients(): RedisClients {
  const commands = connect("commands");
  const pub = connect("pub");
  const sub = connect("sub");

  return {
    commands,
    pub,
    sub,
    isReady: () =>
      commands.status === "ready" &&
      pub.status === "ready" &&
      sub.status === "ready",
    close: async () => {
      await Promise.allSettled([commands.quit(), pub.quit(), sub.quit()]);
    },
  };
}

export async function connectRedis(clients: RedisClients): Promise<void> {
  await Promise.all([
    clients.commands.connect(),
    clients.pub.connect(),
    clients.sub.connect(),
  ]);
}
