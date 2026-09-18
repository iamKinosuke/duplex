"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createSocket, type DuplexSocket } from "./socket";

const SocketContext = createContext<DuplexSocket | null>(null);

export function useSocket(): DuplexSocket | null {
  return useContext(SocketContext);
}

export function useSocketConnected(): boolean {
  const socket = useSocket();

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (socket === null) return () => undefined;

      socket.on("connect", onChange);
      socket.on("disconnect", onChange);

      return () => {
        socket.off("connect", onChange);
        socket.off("disconnect", onChange);
      };
    },
    [socket],
  );

  return useSyncExternalStore(
    subscribe,
    () => socket?.connected ?? false,
    () => false,
  );
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState<DuplexSocket>(createSocket);

  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
