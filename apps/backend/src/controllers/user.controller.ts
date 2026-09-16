import type { RequestHandler } from "express";
import { zUpdateProfileBody } from "@duplex/shared";

import { currentUser } from "../middleware/auth.js";
import type { UserService } from "../services/user.service.js";

export interface UserControllerDeps {
  service: UserService;
}

export function createUserController(deps: UserControllerDeps) {
  const me: RequestHandler = async (req, res) => {
    const user = currentUser(req);
    res.status(200).json(await deps.service.me(user.id));
  };

  const updateProfile: RequestHandler = async (req, res) => {
    const user = currentUser(req);
    const body = zUpdateProfileBody.parse(req.body);

    res.status(200).json(await deps.service.updateProfile(user.id, body));
  };

  return { me, updateProfile };
}
