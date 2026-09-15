import type { ErrorCode } from "@duplex/shared";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: Record<string, string[]> | undefined;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, string[]>): AppError {
    return new AppError(400, "VALIDATION_FAILED", message, details);
  }

  static unauthenticated(message = "Sign in to continue."): AppError {
    return new AppError(401, "UNAUTHENTICATED", message);
  }

  static forbidden(message = "You do not have access to this."): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Not found."): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, "CONFLICT", message);
  }

  static rateLimited(message = "Too many requests. Please slow down."): AppError {
    return new AppError(429, "RATE_LIMITED", message);
  }
}
