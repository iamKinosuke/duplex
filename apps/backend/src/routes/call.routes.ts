import { Router, type RequestHandler } from "express";
import type { IceConfig } from "@duplex/shared";

import { iceServers } from "../config/env.js";

export interface CallRouterDeps {
  requireAuth: RequestHandler;
}

export function createCallRouter(deps: CallRouterDeps): Router {
  const router = Router();

  router.get("/ice", deps.requireAuth, (_req, res) => {
    const payload: IceConfig = { iceServers: iceServers() };
    res.status(200).json(payload);
  });

  return router;
}
