import { ZodError } from "zod";
import type { Ack } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import { logger } from "../lib/logger.js";

export function failure(error: unknown): Ack<never> {
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};

    for (const issue of error.issues) {
      const key = issue.path.join(".") || "(root)";
      (details[key] ??= []).push(issue.message);
    }

    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Some fields need fixing.",
        details,
      },
    };
  }

  if (error instanceof AppError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  logger.error("unhandled socket error", {
    error: error instanceof Error ? error.message : String(error),
  });

  return {
    ok: false,
    error: { code: "INTERNAL", message: "Something went wrong on our side." },
  };
}

export function success<T>(data: T): Ack<T> {
  return { ok: true, data };
}
