import type { Request, RequestHandler } from "express";
import {
  zCreateDirectBody,
  zId,
  zMessagePageQuery,
  type ConversationList,
  type MessagePage,
} from "@duplex/shared";

import { currentUser } from "../middleware/auth.js";
import type { ConversationService } from "../services/conversation.service.js";
import type { MessageService } from "../services/message.service.js";
import { toBigInt } from "../utils/serialize.js";

export interface ConversationControllerDeps {
  conversations: ConversationService;
  messages: MessageService;
}

function conversationIdOf(req: Request): bigint {
  return toBigInt(zId.parse(req.params["id"]));
}

export function createConversationController(deps: ConversationControllerDeps) {
  const list: RequestHandler = async (req, res) => {
    const user = currentUser(req);

    const payload: ConversationList = {
      items: await deps.conversations.list(user.id),
    };
    res.status(200).json(payload);
  };

  const detail: RequestHandler = async (req, res) => {
    const user = currentUser(req);

    res
      .status(200)
      .json(await deps.conversations.detail(conversationIdOf(req), user.id));
  };

  const openDirect: RequestHandler = async (req, res) => {
    const user = currentUser(req);
    const body = zCreateDirectBody.parse(req.body);

    const result = await deps.conversations.openDirect(
      user.id,
      toBigInt(body.userId),
    );

    res.status(result.created ? 201 : 200).json(result.conversation);
  };

  const messages: RequestHandler = async (req, res) => {
    const user = currentUser(req);
    const query = zMessagePageQuery.parse(req.query);

    const payload: MessagePage = await deps.messages.page({
      conversationId: conversationIdOf(req),
      userId: user.id,
      before: query.before === null || query.before === undefined
        ? null
        : toBigInt(query.before),
      limit: query.limit,
    });

    res.status(200).json(payload);
  };

  return { list, detail, openDirect, messages };
}
