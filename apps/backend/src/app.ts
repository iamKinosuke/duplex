import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";

import { env, isProduction, trustProxySetting } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { createErrorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import type { RedisClients } from "./lib/redis.js";

export interface CreateAppDeps {
  redis?: RedisClients;
}

export function createApp(deps: CreateAppDeps = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
  app.set("trust proxy", trustProxySetting());

  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

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

  app.use(notFoundHandler);
  app.use(createErrorHandler({ includeDebugDetails: !isProduction }));

  return app;
}
