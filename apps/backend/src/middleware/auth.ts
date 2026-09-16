import type { RequestHandler } from "express";

import { AppError } from "../errors/AppError.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { verifyAccessToken } from "../utils/jwt.js";

export interface AuthenticatedUser {
  id: bigint;
  username: string;
}

export interface AuthDeps {
  secret: string;
  users: Pick<UserRepository, "existsById">;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || token === undefined) return null;

  const trimmed = token.trim();
  return trimmed === "" ? null : trimmed;
}

function resolveUser(
  header: string | undefined,
  secret: string,
): AuthenticatedUser | null {
  const token = bearerToken(header);
  if (token === null) return null;

  const payload = verifyAccessToken(token, secret);
  if (payload === null) return null;

  if (!/^\d+$/.test(payload.sub)) return null;

  const id = BigInt(payload.sub);
  if (id <= 0n) return null;

  return { id, username: payload.username };
}

export function requireAuth(deps: AuthDeps): RequestHandler {
  return async (req, _res, next) => {
    const user = resolveUser(req.headers.authorization, deps.secret);

    if (user === null) {
      next(AppError.unauthenticated("Sign in to continue."));
      return;
    }

    if (!(await deps.users.existsById(user.id))) {
      next(AppError.unauthenticated("That session is no longer valid."));
      return;
    }

    req.user = user;
    next();
  };
}

export function currentUser(req: {
  user?: AuthenticatedUser;
}): AuthenticatedUser {
  if (req.user === undefined) {
    throw AppError.unauthenticated("Sign in to continue.");
  }
  return req.user;
}
