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

export function verifyAccessToken(
  token: string,
  secret: string,
): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

    if (typeof decoded !== "object" || decoded === null) return null;

    const { sub, username } = decoded as jwt.JwtPayload & {
      username?: unknown;
    };

    if (typeof sub !== "string" || typeof username !== "string") return null;

    return { sub, username };
  } catch {
    return null;
  }
}
