import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";

import { env, isProduction, trustProxySetting } from "./config/env.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createUserController } from "./controllers/user.controller.js";
import { prisma } from "./db/prisma.js";
import { requireAuth } from "./middleware/auth.js";
import { createErrorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import {
  createNoopRateLimiter,
  createRateLimiter,
  rateLimit,
  ruleFromWindow,
  type RateLimitOptions,
} from "./middleware/rate-limit.js";
import { createRefreshTokenRepository } from "./repositories/refresh-token.repository.js";
import { createUserRepository } from "./repositories/user.repository.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createUserRouter } from "./routes/user.routes.js";
import { createAuthService } from "./services/auth.service.js";
import { createTokenService } from "./services/token.service.js";
import { createUserService } from "./services/user.service.js";
import type { RedisClients } from "./lib/redis.js";
import type { RefreshCookieConfig } from "./utils/cookies.js";

export interface CreateAppDeps {
  redis?: RedisClients;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createApp(deps: CreateAppDeps = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.set("trust proxy", trustProxySetting());

  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  const userRepository = createUserRepository(prisma);
  const refreshTokenRepository = createRefreshTokenRepository(prisma);

  const tokenService = createTokenService({
    refreshTokens: refreshTokenRepository,
    jwt: {
      secret: env.JWT_SECRET,
      expiresInSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
    },
    refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  });

  const cookie: RefreshCookieConfig = {
    secure: isProduction,
    maxAgeMs: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
    domain: env.COOKIE_DOMAIN,
  };

  const authService = createAuthService({
    users: userRepository,
    tokens: tokenService,
  });
  const userService = createUserService({ users: userRepository });

  const authController = createAuthController({ service: authService, cookie });
  const userController = createUserController({ service: userService });

  const limiter =
    deps.redis !== undefined
      ? createRateLimiter(deps.redis)
      : createNoopRateLimiter();

  const limit = (options: Omit<RateLimitOptions, "limiter">): RequestHandler =>
    rateLimit({ limiter, ...options });

  const authGuard = requireAuth({
    secret: env.JWT_SECRET,
    users: userRepository,
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      env: env.NODE_ENV,
      uptime: Math.round(process.uptime()),
      pid: process.pid,
      redis: deps.redis?.isReady() === true ? "ready" : "unavailable",
    });
  });

  app.get("/health/deep", (_req, res, next) => {
    void prisma
      .$queryRaw`SELECT 1`
      .then(() => {
        res.json({
          status: "ok",
          database: "ready",
          redis: deps.redis?.isReady() === true ? "ready" : "unavailable",
        });
      })
      .catch(next);
  });

  app.use(
    "/api/auth",
    createAuthRouter({
      controller: authController,
      userController,
      requireAuth: authGuard,
      credentialsRateLimit: limit({
        rule: ruleFromWindow(
          env.RATE_LIMIT_LOGIN_MAX,
          env.RATE_LIMIT_LOGIN_WINDOW_MS,
        ),
        keyPrefix: "rl:credentials",
        message: "Too many sign-in attempts. Please wait before trying again.",
      }),
      refreshRateLimit: limit({
        rule: ruleFromWindow(
          env.RATE_LIMIT_REFRESH_MAX,
          env.RATE_LIMIT_REFRESH_WINDOW_MS,
        ),
        keyPrefix: "rl:refresh",
      }),
    }),
  );

  app.use(
    "/api/users",
    createUserRouter({
      controller: userController,
      requireAuth: authGuard,
      profileRateLimit: limit({
        rule: ruleFromWindow(
          env.RATE_LIMIT_PROFILE_MAX,
          env.RATE_LIMIT_PROFILE_WINDOW_MS,
        ),
        keyPrefix: "rl:profile",
      }),
    }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler({ includeDebugDetails: !isProduction }));

  return app;
}
