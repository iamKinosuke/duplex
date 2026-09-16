import { Router, type RequestHandler } from "express";

import type { createAuthController } from "../controllers/auth.controller.js";
import type { createUserController } from "../controllers/user.controller.js";

type AuthController = ReturnType<typeof createAuthController>;
type UserController = ReturnType<typeof createUserController>;

export interface AuthRouterDeps {
  controller: AuthController;
  userController: UserController;
  requireAuth: RequestHandler;
  credentialsRateLimit: RequestHandler;
  refreshRateLimit: RequestHandler;
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post("/register", deps.credentialsRateLimit, deps.controller.register);
  router.post("/login", deps.credentialsRateLimit, deps.controller.login);
  router.post("/refresh", deps.refreshRateLimit, deps.controller.refresh);
  router.post("/logout", deps.controller.logout);
  router.get("/me", deps.requireAuth, deps.userController.me);

  return router;
}
