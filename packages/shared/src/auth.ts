import { z } from "zod";
import { LIMITS } from "./limits";
import { zUser } from "./user";

export const zRegisterBody = z.object({
  email: z.email().max(255),
  username: z
    .string()
    .min(LIMITS.username.min)
    .max(LIMITS.username.max)
    .regex(LIMITS.username.pattern, "only a-z, 0-9 and underscore"),
  displayName: z
    .string()
    .trim()
    .min(LIMITS.displayName.min)
    .max(LIMITS.displayName.max),
  password: z.string().min(LIMITS.password.min).max(LIMITS.password.max),
});
export type RegisterBody = z.infer<typeof zRegisterBody>;

export const zLoginBody = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(LIMITS.password.max),
});
export type LoginBody = z.infer<typeof zLoginBody>;

export const zAuthResponse = z.object({
  user: zUser,
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type AuthResponse = z.infer<typeof zAuthResponse>;
