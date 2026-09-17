import { createHash, randomBytes, randomUUID } from "node:crypto";

import { AppError } from "../errors/AppError.js";
import type { RefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { signAccessToken, type JwtConfig } from "../utils/jwt.js";

const REFRESH_TOKEN_BYTES = 32;

export interface AccessGrant {
  accessToken: string;
  expiresIn: number;
}

export interface RefreshGrant {
  token: string;
  familyId: string;
  expiresAt: Date;
}

export interface RotatedRefresh extends RefreshGrant {
  userId: bigint;
}

export interface TokenServiceDeps {
  refreshTokens: RefreshTokenRepository;
  jwt: JwtConfig;
  refreshTtlDays: number;
  now?: () => Date;
}

export interface TokenService {
  signAccess(user: { id: bigint; username: string }): AccessGrant;
  issueRefresh(userId: bigint, userAgent: string | null): Promise<RefreshGrant>;
  rotateRefresh(
    rawToken: string,
    userAgent: string | null,
  ): Promise<RotatedRefresh>;
  revokeSession(rawToken: string): Promise<bigint | null>;
  hashToken(rawToken: string): string;
}

export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function createTokenService(deps: TokenServiceDeps): TokenService {
  const now = deps.now ?? (() => new Date());
  const ttlMs = deps.refreshTtlDays * 24 * 60 * 60 * 1000;

  async function persist(
    userId: bigint,
    familyId: string,
    userAgent: string | null,
  ): Promise<RefreshGrant> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
    const expiresAt = new Date(now().getTime() + ttlMs);

    await deps.refreshTokens.create({
      userId,
      tokenHash: hashRefreshToken(token),
      familyId,
      userAgent,
      expiresAt,
    });

    return { token, familyId, expiresAt };
  }

  return {
    signAccess(user) {
      return {
        accessToken: signAccessToken(
          { sub: user.id.toString(), username: user.username },
          deps.jwt,
        ),
        expiresIn: deps.jwt.expiresInSeconds,
      };
    },

    async issueRefresh(userId, userAgent) {
      return await persist(userId, randomUUID(), userAgent);
    },

    async rotateRefresh(rawToken, userAgent) {
      const at = now();
      const stored = await deps.refreshTokens.findByHash(
        hashRefreshToken(rawToken),
      );

      if (stored === null) {
        throw AppError.unauthenticated("That session is no longer valid.");
      }

      if (stored.revokedAt !== null) {
        await deps.refreshTokens.revokeFamily(stored.familyId, at);
        throw new AppError(
          401,
          "TOKEN_REUSED",
          "This session was already used from somewhere else. Sign in again.",
        );
      }

      if (stored.expiresAt.getTime() <= at.getTime()) {
        await deps.refreshTokens.revokeIfActive(stored.id, at);
        throw new AppError(
          401,
          "TOKEN_EXPIRED",
          "Your session expired. Sign in again.",
        );
      }

      const claimed = await deps.refreshTokens.revokeIfActive(stored.id, at);

      if (!claimed) {
        await deps.refreshTokens.revokeFamily(stored.familyId, at);
        throw new AppError(
          401,
          "TOKEN_REUSED",
          "This session was already used from somewhere else. Sign in again.",
        );
      }

      const next = await persist(stored.userId, stored.familyId, userAgent);
      return { ...next, userId: stored.userId };
    },

    async revokeSession(rawToken) {
      const stored = await deps.refreshTokens.findByHash(
        hashRefreshToken(rawToken),
      );
      if (stored === null) return null;

      await deps.refreshTokens.deleteFamily(stored.familyId);
      return stored.userId;
    },

    hashToken(rawToken) {
      return hashRefreshToken(rawToken);
    },
  };
}
