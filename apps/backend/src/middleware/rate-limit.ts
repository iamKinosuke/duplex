import type { Request, RequestHandler } from "express";
import type { Redis } from "ioredis";

import { AppError } from "../errors/AppError.js";
import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";

const TOKEN_BUCKET_COMMAND = "duplexTokenBucket";

const TOKEN_BUCKET_SCRIPT = `
local key         = KEYS[1]
local capacity    = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2])
local cost        = tonumber(ARGV[3])
local now         = tonumber(ARGV[4])

local state = redis.call('HMGET', key, 'tokens', 'updatedAt')
local tokens = tonumber(state[1])
local updatedAt = tonumber(state[2])

if tokens == nil or updatedAt == nil then
  tokens = capacity
  updatedAt = now
end

local elapsed = now - updatedAt
if elapsed > 0 then
  tokens = math.min(capacity, tokens + elapsed * refillPerMs)
end

local allowed = 0
local retryAfterMs = 0

if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
else
  retryAfterMs = math.ceil((cost - tokens) / refillPerMs)
end

redis.call('HSET', key, 'tokens', tokens, 'updatedAt', now)
redis.call('PEXPIRE', key, math.ceil(capacity / refillPerMs) + 1000)

return { allowed, math.floor(tokens), retryAfterMs }
`;

export interface RateLimitRule {
  capacity: number;
  refillPerSecond: number;
  cost?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

type BucketClient = Redis & {
  [TOKEN_BUCKET_COMMAND]: (
    key: string,
    capacity: string,
    refillPerMs: string,
    cost: string,
    now: string,
  ) => Promise<[number, number, number]>;
};

export function ruleFromWindow(max: number, windowMs: number): RateLimitRule {
  return { capacity: max, refillPerSecond: (max * 1000) / windowMs };
}

export function createNoopRateLimiter(): RateLimiter {
  return {
    async consume(_key, rule) {
      return {
        allowed: true,
        remaining: rule.capacity,
        retryAfterMs: 0,
      };
    },
  };
}

export function createRateLimiter(redis: RedisClients): RateLimiter {
  const client = redis.commands as BucketClient;

  client.defineCommand(TOKEN_BUCKET_COMMAND, {
    numberOfKeys: 1,
    lua: TOKEN_BUCKET_SCRIPT,
  });

  return {
    async consume(key, rule) {
      const cost = rule.cost ?? 1;

      if (!redis.isReady()) {
        return { allowed: true, remaining: rule.capacity, retryAfterMs: 0 };
      }

      try {
        const [allowed, remaining, retryAfterMs] = await client[
          TOKEN_BUCKET_COMMAND
        ](
          key,
          String(rule.capacity),
          String(rule.refillPerSecond / 1000),
          String(cost),
          String(Date.now()),
        );

        return { allowed: allowed === 1, remaining, retryAfterMs };
      } catch (error) {
        logger.warn("rate limiter unavailable, allowing request", {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        return { allowed: true, remaining: rule.capacity, retryAfterMs: 0 };
      }
    },
  };
}

export interface RateLimitOptions {
  limiter: RateLimiter;
  rule: RateLimitRule;
  keyPrefix: string;
  identify?: (req: Request) => string;
  message?: string;
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const identify =
    options.identify ??
    ((req: Request) => req.user?.id.toString() ?? req.ip ?? "unknown");

  return async (req, res, next) => {
    const result = await options.limiter.consume(
      `${options.keyPrefix}:${identify(req)}`,
      options.rule,
    );

    res.setHeader("X-RateLimit-Limit", String(options.rule.capacity));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));

    if (result.allowed) {
      next();
      return;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));

    next(
      AppError.rateLimited(
        options.message ??
          `Too many requests. Try again in ${retryAfterSeconds}s.`,
      ),
    );
  };
}
