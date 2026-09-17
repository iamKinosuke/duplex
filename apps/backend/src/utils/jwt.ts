import jwt from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: string;
  username: string;
}

export interface JwtConfig {
  secret: string;
  expiresInSeconds: number;
}

export function signAccessToken(
  payload: AccessTokenPayload,
  config: JwtConfig,
): string {
  return jwt.sign(payload, config.secret, {
    expiresIn: config.expiresInSeconds,
    algorithm: "HS256",
  });
}

export type AccessTokenResult =
  | { ok: true; payload: AccessTokenPayload }
  | { ok: false; reason: "expired" | "invalid" };

export function readAccessToken(
  token: string,
  secret: string,
): AccessTokenResult {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

    if (typeof decoded !== "object" || decoded === null) {
      return { ok: false, reason: "invalid" };
    }

    const { sub, username } = decoded as jwt.JwtPayload & {
      username?: unknown;
    };

    if (typeof sub !== "string" || typeof username !== "string") {
      return { ok: false, reason: "invalid" };
    }

    return { ok: true, payload: { sub, username } };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof jwt.TokenExpiredError ? "expired" : "invalid",
    };
  }
}

export function verifyAccessToken(
  token: string,
  secret: string,
): AccessTokenPayload | null {
  const result = readAccessToken(token, secret);
  return result.ok ? result.payload : null;
}
