import type { RequestHandler } from "express";
import {
  LIMITS,
  zUpdateProfileBody,
  zUserSearchQuery,
  type UserList,
} from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
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

  const search: RequestHandler = async (req, res) => {
    const user = currentUser(req);
    const query = zUserSearchQuery.parse(req.query);

    const payload: UserList = {
      items: await deps.service.search(user.id, query.q, query.limit),
    };
    res.status(200).json(payload);
  };

  const profile: RequestHandler = async (req, res) => {
    const raw = req.params["username"];
    const username = typeof raw === "string" ? raw : "";

    if (!LIMITS.username.pattern.test(username)) {
      throw AppError.notFound("That person does not exist.");
    }

    res.status(200).json(await deps.service.profile(username));
  };

  return { me, updateProfile, search, profile };
}
