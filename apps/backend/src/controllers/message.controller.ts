import type { RequestHandler } from "express";
import { zMessageSearchQuery, type MessagePage } from "@duplex/shared";

import { currentUser } from "../middleware/auth.js";
import type { MessageService } from "../services/message.service.js";
import { toBigInt } from "../utils/serialize.js";

export interface MessageControllerDeps {
  messages: MessageService;
}

export function createMessageController(deps: MessageControllerDeps) {
  const search: RequestHandler = async (req, res) => {
    const user = currentUser(req);
    const query = zMessageSearchQuery.parse(req.query);

    const payload: MessagePage = await deps.messages.search({
      userId: user.id,
      query: query.q,
      before:
        query.before === null || query.before === undefined
          ? null
          : toBigInt(query.before),
      limit: query.limit,
    });

    res.status(200).json(payload);
  };

  return { search };
}
