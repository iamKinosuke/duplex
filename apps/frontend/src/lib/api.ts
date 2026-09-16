import { zApiError, zAuthResponse, type ApiError } from "@duplex/shared";
import type { z } from "zod";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string[]> | undefined;

  constructor(status: number, error: ApiError["error"]) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }

  fieldError(field: string): string | undefined {
    return this.details?.[field]?.[0];
  }
}

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

let refreshing: Promise<boolean> | null = null;

async function requestRefresh(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      accessToken = null;
      return false;
    }

    const session = zAuthResponse.parse(await response.json());
    accessToken = session.accessToken;
    return true;
  } catch {
    accessToken = null;
    return false;
  }
}

export function refreshSession(): Promise<boolean> {
  refreshing ??= requestRefresh().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

export interface ApiRequest<T> {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: z.ZodType<T>;
  auth?: boolean;
  signal?: AbortSignal;
}

function send(
  request: ApiRequest<unknown>,
  token: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (request.body !== undefined) headers["Content-Type"] = "application/json";
  if (token !== null) headers["Authorization"] = `Bearer ${token}`;

  return fetch(request.path, {
    method: request.method ?? "GET",
    credentials: "include",
    headers,
    ...(request.body !== undefined
      ? { body: JSON.stringify(request.body) }
      : {}),
    ...(request.signal !== undefined ? { signal: request.signal } : {}),
  });
}

async function toError(response: Response): Promise<ApiRequestError> {
  const fallback = new ApiRequestError(response.status, {
    code: "INTERNAL",
    message: `Request failed with status ${response.status}.`,
  });

  try {
    const parsed = zApiError.safeParse(await response.json());

    return parsed.success
      ? new ApiRequestError(response.status, parsed.data.error)
      : fallback;
  } catch {
    return fallback;
  }
}

export async function apiFetch<T>(request: ApiRequest<T>): Promise<T> {
  const withAuth = request.auth ?? true;

  let response = await send(request, withAuth ? accessToken : null);

  if (response.status === 401 && withAuth) {
    const recovered = await refreshSession();
    if (recovered) {
      response = await send(request, accessToken);
    }
  }

  if (!response.ok) {
    throw await toError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json();

  return request.schema === undefined
    ? (payload as T)
    : request.schema.parse(payload);
}
