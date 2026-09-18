import { TIMINGS } from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";

export interface PresenceEntry {
  userId: string;
  socketId: string;
}

export interface PresenceTracker {
  online(userId: string, socketId: string): Promise<boolean>;
  offline(userId: string, socketId: string): Promise<boolean>;
  refresh(entries: ReadonlyArray<PresenceEntry>): Promise<string[]>;
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

    async refresh(entries) {
      if (entries.length === 0) return [];

      try {
        const pipeline = redis.commands.multi();

        for (const entry of entries) {
          pipeline.sadd(keyFor(entry.userId), entry.socketId);
          pipeline.expire(keyFor(entry.userId), ttl);
        }

        const results = await pipeline.exec();
        if (results === null) return [];

        const restored = new Set<string>();

        entries.forEach((entry, index) => {
          const added = results[index * 2]?.[1];
          if (typeof added === "number" && added === 1) restored.add(entry.userId);
        });

        return [...restored];
      } catch (error) {
        report("refresh", error);
        return [];
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
