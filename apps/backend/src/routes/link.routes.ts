import { Router, type RequestHandler } from "express";

import type { createLinkController } from "../controllers/link.controller.js";

type LinkController = ReturnType<typeof createLinkController>;

export interface LinkRouterDeps {
  controller: LinkController;
  requireAuth: RequestHandler;
  previewRateLimit: RequestHandler;
}

export function createLinkRouter(deps: LinkRouterDeps): Router {
  const router = Router();

  router.get(
    "/preview",
    deps.requireAuth,
    deps.previewRateLimit,
    deps.controller.preview,
  );

  return router;
}
