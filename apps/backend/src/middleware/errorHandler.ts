import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/AppError.js";
import { logger } from "../lib/logger.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
};

export function createErrorHandler(options: {
  includeDebugDetails: boolean;
}): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "(root)";
        (details[key] ??= []).push(issue.message);
      }

      res.status(400).json({
        error: {
          code: "VALIDATION_FAILED",
          message: "Some fields need fixing.",
          details,
        },
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error("unhandled error", {
      method: req.method,
      path: req.path,
      error: message,
      ...(error instanceof Error && error.stack !== undefined
        ? { stack: error.stack }
        : {}),
    });

    res.status(500).json({
      error: {
        code: "INTERNAL",
        message: options.includeDebugDetails
          ? message
          : "Something went wrong on our side.",
      },
    });
  };
}
