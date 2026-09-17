import { Router, type RequestHandler } from "express";

import type { createUserController } from "../controllers/user.controller.js";

type UserController = ReturnType<typeof createUserController>;

export interface UserRouterDeps {
  controller: UserController;
  requireAuth: RequestHandler;
  profileRateLimit: RequestHandler;
  searchRateLimit: RequestHandler;
}

export function createUserRouter(deps: UserRouterDeps): Router {
  const router = Router();

  router.get("/", deps.requireAuth, deps.searchRateLimit, deps.controller.search);
  router.get("/me", deps.requireAuth, deps.controller.me);
  router.patch(
    "/me",
    deps.requireAuth,
    deps.profileRateLimit,
    deps.controller.updateProfile,
  );

  return router;
}
