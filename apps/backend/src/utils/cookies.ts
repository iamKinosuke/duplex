import type { CookieOptions, Response } from "express";

export const REFRESH_COOKIE_NAME = "duplex_refresh";
export const REFRESH_COOKIE_PATH = "/api/auth";

export interface RefreshCookieConfig {
  secure: boolean;
  maxAgeMs: number;
  domain?: string | undefined;
}

function baseOptions(config: RefreshCookieConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secure,
    path: REFRESH_COOKIE_PATH,
    ...(config.domain !== undefined ? { domain: config.domain } : {}),
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  config: RefreshCookieConfig,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(config),
    maxAge: config.maxAgeMs,
  });
}

export function clearRefreshCookie(
  res: Response,
  config: RefreshCookieConfig,
): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions(config));
}
