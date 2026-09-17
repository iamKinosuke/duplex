import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DATABASE_URL: z
    .string()
    .min(1, "is required")
    .startsWith("mysql://", "must start with mysql://"),

  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  REDIS_PREFIX: z.string().min(1).default("duplex:"),

  FRONTEND_ORIGIN: z.url().default("http://localhost:3000"),
  COOKIE_DOMAIN: z.string().min(1).optional(),

  JWT_SECRET: z
    .string()
    .min(32, "must be at least 32 characters (use `openssl rand -base64 32`)"),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),

  TRUST_PROXY: z.string().default("loopback"),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).default(10),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().min(1).default(300_000),
  RATE_LIMIT_MESSAGE_MAX: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_MESSAGE_WINDOW_MS: z.coerce.number().int().min(1).default(10_000),
  RATE_LIMIT_REFRESH_MAX: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_REFRESH_WINDOW_MS: z.coerce.number().int().min(1).default(300_000),
  RATE_LIMIT_PROFILE_MAX: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_PROFILE_WINDOW_MS: z.coerce.number().int().min(1).default(60_000),
  RATE_LIMIT_READ_MAX: z.coerce.number().int().min(1).default(240),
  RATE_LIMIT_READ_WINDOW_MS: z.coerce.number().int().min(1).default(60_000),
  RATE_LIMIT_SEARCH_MAX: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_SEARCH_WINDOW_MS: z.coerce.number().int().min(1).default(60_000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("✗ Invalid environment configuration:\n");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  console.error("\nSee apps/backend/.env.example\n");
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

export const databaseLabel = (() => {
  try {
    const url = new URL(env.DATABASE_URL);
    return `${url.host}${url.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
})();

export function trustProxySetting(): boolean | number | string {
  const raw = env.TRUST_PROXY.trim();

  if (raw === "false") return false;
  if (raw === "true") return true;

  const hops = Number(raw);
  if (Number.isInteger(hops) && hops >= 0) return hops;

  return raw;
}
