import type { CallKind } from "@duplex/shared";

import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";

export interface CallRecord {
  callId: string;
  callerId: string;
  calleeId: string;
  conversationId: string;
  kind: CallKind;
  state: "ringing" | "active";
  startedAt: string;
  answeredAt: string | null;
}

export type ClaimResult = "claimed" | "caller-busy" | "callee-busy";

export interface CallStore {
  claim(record: CallRecord): Promise<ClaimResult>;
  find(callId: string): Promise<CallRecord | null>;
  answer(callId: string, at: string): Promise<CallRecord | null>;
  release(callId: string): Promise<CallRecord | null>;
  activeOf(userId: string): Promise<string | null>;
}

const TTL_SECONDS = 2 * 60 * 60;

const RELEASE_IF_MINE = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

function callKey(callId: string): string {
  return `call:${callId}`;
}

function userKey(userId: string): string {
  return `call:user:${userId}`;
}

function report(action: string, error: unknown): void {
  logger.error("call store failed", {
    action,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function createCallStore(redis: RedisClients): CallStore {
  async function releaseIfMine(userId: string, callId: string): Promise<void> {
    await redis.commands.eval(RELEASE_IF_MINE, 1, userKey(userId), callId);
  }

  async function read(callId: string): Promise<CallRecord | null> {
    const raw = await redis.commands.get(callKey(callId));
    return raw === null ? null : (JSON.parse(raw) as CallRecord);
  }

  async function write(record: CallRecord): Promise<void> {
    await redis.commands.set(
      callKey(record.callId),
      JSON.stringify(record),
      "EX",
      TTL_SECONDS,
    );
  }

  return {
    async claim(record) {
      try {
        const caller = await redis.commands.set(
          userKey(record.callerId),
          record.callId,
          "EX",
          TTL_SECONDS,
          "NX",
        );

        if (caller === null) return "caller-busy";

        const callee = await redis.commands.set(
          userKey(record.calleeId),
          record.callId,
          "EX",
          TTL_SECONDS,
          "NX",
        );

        if (callee === null) {
          await releaseIfMine(record.callerId, record.callId);
          return "callee-busy";
        }

        await write(record);
        return "claimed";
      } catch (error) {
        report("claim", error);
        await releaseIfMine(record.callerId, record.callId);
        await releaseIfMine(record.calleeId, record.callId);
        return "caller-busy";
      }
    },

    async find(callId) {
      try {
        return await read(callId);
      } catch (error) {
        report("find", error);
        return null;
      }
    },

    async answer(callId, at) {
      try {
        const record = await read(callId);
        if (record === null || record.state === "active") return record;

        const answered: CallRecord = {
          ...record,
          state: "active",
          answeredAt: at,
        };
        await write(answered);

        return answered;
      } catch (error) {
        report("answer", error);
        return null;
      }
    },

    async release(callId) {
      try {
        const record = await read(callId);
        if (record === null) return null;

        await redis.commands.del(callKey(callId));
        await releaseIfMine(record.callerId, callId);
        await releaseIfMine(record.calleeId, callId);

        return record;
      } catch (error) {
        report("release", error);
        return null;
      }
    },

    async activeOf(userId) {
      try {
        return await redis.commands.get(userKey(userId));
      } catch (error) {
        report("activeOf", error);
        return null;
      }
    },
  };
}
