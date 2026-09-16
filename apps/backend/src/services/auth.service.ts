import type { LoginBody, RegisterBody, User } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import {
  DuplicateUserError,
  type UserRecord,
  type UserRepository,
} from "../repositories/user.repository.js";
import { toUser } from "../utils/serialize.js";
import {
  burnPasswordVerification,
  hashPassword,
  verifyPassword,
} from "../utils/password.js";
import type { TokenService } from "./token.service.js";

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface RequestContext {
  userAgent: string | null;
}

export interface AuthServiceDeps {
  users: UserRepository;
  tokens: TokenService;
}

export interface AuthService {
  register(body: RegisterBody, context: RequestContext): Promise<AuthSession>;
  login(body: LoginBody, context: RequestContext): Promise<AuthSession>;
  refresh(rawToken: string, context: RequestContext): Promise<AuthSession>;
  logout(rawToken: string): Promise<void>;
}

const CREDENTIALS_REJECTED = "Incorrect email or password.";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  function sessionFor(
    user: UserRecord,
    refresh: { token: string; expiresAt: Date },
  ): AuthSession {
    const access = deps.tokens.signAccess(user);

    return {
      user: toUser(user),
      accessToken: access.accessToken,
      expiresIn: access.expiresIn,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  async function startSession(
    user: UserRecord,
    context: RequestContext,
  ): Promise<AuthSession> {
    const refresh = await deps.tokens.issueRefresh(user.id, context.userAgent);
    return sessionFor(user, refresh);
  }

  return {
    async register(body, context) {
      const email = normalizeEmail(body.email);
      const passwordHash = await hashPassword(body.password);

      try {
        const user = await deps.users.create({
          email,
          username: body.username,
          displayName: body.displayName,
          passwordHash,
        });

        return await startSession(user, context);
      } catch (error) {
        if (error instanceof DuplicateUserError) {
          throw AppError.conflict(
            error.field === "username"
              ? "That username is already taken."
              : "An account with this email already exists.",
          );
        }
        throw error;
      }
    },

    async login(body, context) {
      const email = normalizeEmail(body.email);
      const user = await deps.users.findByEmail(email);

      if (user === null) {
        await burnPasswordVerification(body.password);
        throw AppError.unauthenticated(CREDENTIALS_REJECTED);
      }

      const valid = await verifyPassword(body.password, user.passwordHash);
      if (!valid) {
        throw AppError.unauthenticated(CREDENTIALS_REJECTED);
      }

      return await startSession(user, context);
    },

    async refresh(rawToken, context) {
      const rotated = await deps.tokens.rotateRefresh(
        rawToken,
        context.userAgent,
      );

      const user = await deps.users.findById(rotated.userId);

      if (user === null) {
        throw AppError.unauthenticated("That session is no longer valid.");
      }

      return sessionFor(user, rotated);
    },

    async logout(rawToken) {
      await deps.tokens.revokeSession(rawToken);
    },
  };
}
