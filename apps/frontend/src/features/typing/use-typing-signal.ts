"use client";

import { useCallback, useEffect, useRef } from "react";
import { TIMINGS, toId } from "@duplex/shared";

import { useSocket } from "@/realtime/socket-provider";

const IDLE_MS = 3_000;

export interface TypingSignal {
  onInput: () => void;
  onSent: () => void;
}

export function useTypingSignal(conversationId: string): TypingSignal {
  const socket = useSocket();

  const emittedAt = useRef<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (debounce.current !== null) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }

    if (idle.current !== null) {
      clearTimeout(idle.current);
      idle.current = null;
    }

    if (emittedAt.current === null) return;

    emittedAt.current = null;
    socket?.emit("typing:stop", { conversationId: toId(conversationId) });
  }, [socket, conversationId]);

  const onInput = useCallback(() => {
    if (socket === null) return;

    if (idle.current !== null) clearTimeout(idle.current);
    idle.current = setTimeout(stop, IDLE_MS);

    const last = emittedAt.current;

    if (last === null) {
      if (debounce.current !== null) return;

      debounce.current = setTimeout(() => {
        debounce.current = null;
        emittedAt.current = Date.now();
        socket.emit("typing:start", { conversationId: toId(conversationId) });
      }, TIMINGS.typingDebounceMs);

      return;
    }

    if (Date.now() - last >= TIMINGS.typingThrottleMs) {
      emittedAt.current = Date.now();
      socket.emit("typing:start", { conversationId: toId(conversationId) });
    }
  }, [socket, conversationId, stop]);

  useEffect(() => stop, [stop]);

  return { onInput, onSent: stop };
}
