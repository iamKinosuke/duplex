import type { RequestHandler } from "express";
import { zLinkPreviewQuery } from "@duplex/shared";

import type { LinkPreviewService } from "../services/link-preview.service.js";

export interface LinkControllerDeps {
  previews: LinkPreviewService;
}

export function createLinkController(deps: LinkControllerDeps) {
  const preview: RequestHandler = async (req, res) => {
    const query = zLinkPreviewQuery.parse(req.query);

    res.status(200).json(await deps.previews.fetch(query.url));
  };

  return { preview };
}
