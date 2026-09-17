import { TIMINGS } from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";

export interface PresenceTracker {
  online(userId: string, socketId: string): Promise<boolean>;
  offline(userId: string, socketId: string): Promise<boolean>;
  heartbeat(userId: string): Promise<void>;
  onlineAmong(userIds: string[]): Promise<string[]>;
}

function keyFor(userId: string): string {
  return `presence:${userId}`;
}

function report(action: string, error: unknown): void {
  logger.warn("presence unavailable", {
    action,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function createPresenceTracker(redis: RedisClients): PresenceTracker {
  const ttl = TIMINGS.presenceTtlSeconds;

  return {
    async online(userId, socketId) {
      try {
        const results = await redis.commands
          .multi()
          .sadd(keyFor(userId), socketId)
          .expire(keyFor(userId), ttl)
          .scard(keyFor(userId))
          .exec();

        const card = results?.[2]?.[1];
        return typeof card === "number" && card === 1;
      } catch (error) {
        report("online", error);
        return false;
      }
    },

    async offline(userId, socketId) {
      try {
        const results = await redis.commands
          .multi()
          .srem(keyFor(userId), socketId)
          .scard(keyFor(userId))
          .exec();

        const card = results?.[1]?.[1];
        const empty = typeof card === "number" && card === 0;

        if (empty) await redis.commands.del(keyFor(userId));

        return empty;
      } catch (error) {
        report("offline", error);
        return false;
      }
    },

    async heartbeat(userId) {
      try {
        await redis.commands.expire(keyFor(userId), ttl);
      } catch (error) {
        report("heartbeat", error);
      }
    },

    async onlineAmong(userIds) {
      if (userIds.length === 0) return [];

      try {
        const pipeline = redis.commands.multi();
        for (const userId of userIds) pipeline.scard(keyFor(userId));

        const results = await pipeline.exec();
        if (results === null) return [];

        return userIds.filter((_, index) => {
          const card = results[index]?.[1];
          return typeof card === "number" && card > 0;
        });
      } catch (error) {
        report("onlineAmong", error);
        return [];
      }
    },
  };
}
