import type { RequestHandler } from "express";
import { zLoginBody, zRegisterBody, type AuthResponse } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import type { AuthService, RequestContext } from "../services/auth.service.js";
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  type RefreshCookieConfig,
} from "../utils/cookies.js";

export interface AuthControllerDeps {
  service: AuthService;
  cookie: RefreshCookieConfig;
}

function contextOf(userAgent: string | undefined): RequestContext {
  if (userAgent === undefined) return { userAgent: null };
  return { userAgent: userAgent.slice(0, 255) };
}

function readRefreshCookie(cookies: unknown): string | null {
  if (typeof cookies !== "object" || cookies === null) return null;

  const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE_NAME];
  return typeof value === "string" && value !== "" ? value : null;
}

export function createAuthController(deps: AuthControllerDeps) {
  const register: RequestHandler = async (req, res) => {
    const body = zRegisterBody.parse(req.body);
    const session = await deps.service.register(
      body,
      contextOf(req.headers["user-agent"]),
    );

    setRefreshCookie(res, session.refreshToken, deps.cookie);

    const payload: AuthResponse = {
      user: session.user,
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    };
    res.status(201).json(payload);
  };

  const login: RequestHandler = async (req, res) => {
    const body = zLoginBody.parse(req.body);
    const session = await deps.service.login(
      body,
      contextOf(req.headers["user-agent"]),
    );

    setRefreshCookie(res, session.refreshToken, deps.cookie);

    const payload: AuthResponse = {
      user: session.user,
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
    };
    res.status(200).json(payload);
  };

  const refresh: RequestHandler = async (req, res) => {
    const token = readRefreshCookie(req.cookies);

    if (token === null) {
      clearRefreshCookie(res, deps.cookie);
      throw AppError.unauthenticated("No session to refresh.");
    }

    try {
      const session = await deps.service.refresh(
        token,
        contextOf(req.headers["user-agent"]),
      );

      setRefreshCookie(res, session.refreshToken, deps.cookie);

      const payload: AuthResponse = {
        user: session.user,
        accessToken: session.accessToken,
        expiresIn: session.expiresIn,
      };
      res.status(200).json(payload);
    } catch (error) {
      clearRefreshCookie(res, deps.cookie);
      throw error;
    }
  };

  const logout: RequestHandler = async (req, res) => {
    const token = readRefreshCookie(req.cookies);

    if (token !== null) {
      await deps.service.logout(token);
    }

    clearRefreshCookie(res, deps.cookie);
    res.status(204).end();
  };

  return { register, login, refresh, logout };
}
