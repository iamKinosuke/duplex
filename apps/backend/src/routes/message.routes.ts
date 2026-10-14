import { Router, type RequestHandler } from "express";

import type { createMessageController } from "../controllers/message.controller.js";

type MessageController = ReturnType<typeof createMessageController>;

export interface MessageRouterDeps {
  controller: MessageController;
  requireAuth: RequestHandler;
  searchRateLimit: RequestHandler;
}

export function createMessageRouter(deps: MessageRouterDeps): Router {
  const router = Router();

  router.get(
    "/search",
    deps.requireAuth,
    deps.searchRateLimit,
    deps.controller.search,
  );

  return router;
}
