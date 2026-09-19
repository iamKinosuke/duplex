import { TIMINGS } from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";

export interface TypingTracker {
  start(conversationId: string, userId: string): Promise<string[]>;
  stop(conversationId: string, userId: string): Promise<string[]>;
  clear(conversationId: string, userId: string): Promise<string[] | null>;
}

function keyFor(conversationId: string): string {
  return `typing:${conversationId}`;
}

function report(action: string, error: unknown): void {
  logger.warn("typing unavailable", {
    action,
    error: error instanceof Error ? error.message : String(error),
  });
}

type PipelineResults = Array<[Error | null, unknown]> | null;

function listAt(results: PipelineResults, index: number): string[] {
  const value = results?.[index]?.[1];
  return Array.isArray(value) ? value.map(String) : [];
}

function countAt(results: PipelineResults, index: number): number {
  const value = results?.[index]?.[1];
  return typeof value === "number" ? value : 0;
}

export function createTypingTracker(redis: RedisClients): TypingTracker {
  const ttlMs = TIMINGS.typingTtlSeconds * 1000;

  async function forget(
    conversationId: string,
    userId: string,
  ): Promise<{ removed: number; userIds: string[] }> {
    const key = keyFor(conversationId);
    const now = Date.now();

    const results = await redis.commands
      .multi()
      .zrem(key, userId)
      .zremrangebyscore(key, 0, now)
      .zrange(key, 0, -1)
      .exec();

    return { removed: countAt(results, 0), userIds: listAt(results, 2) };
  }

  return {
    async start(conversationId, userId) {
      const key = keyFor(conversationId);
      const now = Date.now();

      try {
        const results = await redis.commands
          .multi()
          .zadd(key, now + ttlMs, userId)
          .zremrangebyscore(key, 0, now)
          .zrange(key, 0, -1)
          .pexpire(key, ttlMs)
          .exec();

        return listAt(results, 2);
      } catch (error) {
        report("start", error);
        return [];
      }
    },

    async stop(conversationId, userId) {
      try {
        return (await forget(conversationId, userId)).userIds;
      } catch (error) {
        report("stop", error);
        return [];
      }
    },

    async clear(conversationId, userId) {
      try {
        const result = await forget(conversationId, userId);
        return result.removed === 0 ? null : result.userIds;
      } catch (error) {
        report("clear", error);
        return null;
      }
    },
  };
}
