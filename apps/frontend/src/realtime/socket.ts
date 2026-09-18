import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@duplex/shared";

import { getAccessToken, refreshSession } from "@/lib/api";

export type DuplexSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = process.env["NEXT_PUBLIC_SOCKET_URL"] ?? "";

export function createSocket(): DuplexSocket {
  const socket: DuplexSocket = io(SOCKET_URL, {
    path: "/socket.io",
    autoConnect: false,
    withCredentials: true,
    auth: (done) => {
      done({ token: getAccessToken() ?? "" });
    },
  });

  socket.on("connect_error", (error: Error & { data?: { code?: string } }) => {
    if (error.data?.code !== "TOKEN_EXPIRED") return;

    void refreshSession().then((recovered) => {
      if (recovered) socket.connect();
    });
  });

  return socket;
}

export function ackPromise<T>(
  socket: DuplexSocket,
  emit: (resolve: (value: T) => void) => void,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The server did not answer in time.")),
      timeoutMs,
    );

    emit((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}
