import { z } from "zod";

export const zApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),

    details: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof zApiError>;

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "TOKEN_REUSED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
