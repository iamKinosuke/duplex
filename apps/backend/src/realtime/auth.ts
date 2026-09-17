import type { ExtendedError } from "socket.io";

import type { UserRepository } from "../repositories/user.repository.js";
import { readAccessToken } from "../utils/jwt.js";
import type { RealtimeSocket } from "./server.js";

export interface HandshakeAuthDeps {
  secret: string;
  users: Pick<UserRepository, "existsById">;
}

export type HandshakeErrorCode = "UNAUTHENTICATED" | "TOKEN_EXPIRED";

function handshakeError(code: HandshakeErrorCode, message: string): ExtendedError {
  return Object.assign(new Error(message), { data: { code } });
}

export function createHandshakeAuth(deps: HandshakeAuthDeps) {
  return async (
    socket: RealtimeSocket,
    next: (error?: ExtendedError) => void,
  ): Promise<void> => {
    const raw = socket.handshake.auth["token"];

    if (typeof raw !== "string" || raw.trim() === "") {
      next(handshakeError("UNAUTHENTICATED", "Missing access token."));
      return;
    }

    const result = readAccessToken(raw.trim(), deps.secret);

    if (!result.ok) {
      next(
        result.reason === "expired"
          ? handshakeError(
              "TOKEN_EXPIRED",
              "Your access token expired. Refresh it and reconnect.",
            )
          : handshakeError("UNAUTHENTICATED", "That access token is not valid."),
      );
      return;
    }

    if (!/^\d+$/.test(result.payload.sub)) {
      next(handshakeError("UNAUTHENTICATED", "That access token is not valid."));
      return;
    }

    const userId = BigInt(result.payload.sub);

    if (userId <= 0n || !(await deps.users.existsById(userId))) {
      next(
        handshakeError("UNAUTHENTICATED", "That session is no longer valid."),
      );
      return;
    }

    socket.data.userId = result.payload.sub;
    next();
  };
}
