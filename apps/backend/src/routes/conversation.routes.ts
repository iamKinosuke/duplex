import { Router, type RequestHandler } from "express";

import type { createConversationController } from "../controllers/conversation.controller.js";

type ConversationController = ReturnType<typeof createConversationController>;

export interface ConversationRouterDeps {
  controller: ConversationController;
  requireAuth: RequestHandler;
  readRateLimit: RequestHandler;
  writeRateLimit: RequestHandler;
}

export function createConversationRouter(deps: ConversationRouterDeps): Router {
  const router = Router();

  router.use(deps.requireAuth);

  router.get("/", deps.readRateLimit, deps.controller.list);
  router.post("/direct", deps.writeRateLimit, deps.controller.openDirect);
  router.get("/:id", deps.readRateLimit, deps.controller.detail);
  router.get("/:id/messages", deps.readRateLimit, deps.controller.messages);

  return router;
}
