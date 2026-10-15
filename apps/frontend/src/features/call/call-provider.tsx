"use client";

import {
  CALL_RING_MS,
  toId,
  type Ack,
  type CallIceEvent,
  type CallIdEvent,
  type CallIncoming,
  type CallKind,
  type CallSdpEvent,
  type CallEnded,
} from "@duplex/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ackPromise } from "@/realtime/socket";
import { useSocket } from "@/realtime/socket-provider";
import { useIceConfig } from "./queries";
import { createRinger, type Ringer } from "./ring";

export type CallPhase = "idle" | "calling" | "ringing" | "active";

export interface CallState {
  phase: CallPhase;
  callId: string | null;
  conversationId: string | null;
  peerId: string | null;
  kind: CallKind;
  outgoing: boolean;
  muted: boolean;
  cameraOff: boolean;
  answeredAt: number | null;
  note: string | null;
}

export interface CallActions {
  start: (conversationId: string, kind: CallKind) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  useDevice: (kind: "audio" | "video", deviceId: string) => Promise<void>;
  dismissNote: () => void;
}

export interface CallContextValue extends CallActions {
  state: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const IDLE: CallState = {
  phase: "idle",
  callId: null,
  conversationId: null,
  peerId: null,
  kind: "audio",
  outgoing: false,
  muted: false,
  cameraOff: false,
  answeredAt: null,
  note: null,
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const value = useContext(CallContext);

  if (value === null) throw new Error("useCall needs a CallProvider above it");

  return value;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const ice = useIceConfig();

  const [state, setState] = useState<CallState>(IDLE);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peer = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const answeredHere = useRef(false);
  const callId = useRef<string | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringer = useRef<Ringer | null>(null);

  const teardown = useCallback((note: string | null) => {
    if (ringTimer.current !== null) {
      clearTimeout(ringTimer.current);
      ringTimer.current = null;
    }

    peer.current?.close();
    peer.current = null;

    local.current?.getTracks().forEach((track) => track.stop());
    local.current = null;

    pendingIce.current = [];
    answeredHere.current = false;
    callId.current = null;

    setLocalStream(null);
    setRemoteStream(null);
    setState({ ...IDLE, note });
  }, []);

  const media = useCallback(async (kind: CallKind): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === "video",
    });

    local.current = stream;
    setLocalStream(stream);

    return stream;
  }, []);

  const connection = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: ice.data?.iceServers ?? [],
      });

      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      pc.ontrack = (event) => {
        const [first] = event.streams;
        if (first !== undefined) setRemoteStream(first);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate === null || callId.current === null) return;

        socket?.emit("call:ice", {
          callId: callId.current,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      };

      peer.current = pc;
      return pc;
    },
    [ice.data, socket],
  );

  const flushIce = useCallback(async () => {
    const pc = peer.current;
    if (pc === null) return;

    const queued = pendingIce.current;
    pendingIce.current = [];

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        continue;
      }
    }
  }, []);

  const start = useCallback(
    async (conversationId: string, kind: CallKind) => {
      if (socket === null || state.phase !== "idle") return;

      try {
        const stream = await media(kind);

        const ack = await ackPromise<Ack<{ callId: string }>>(
          socket,
          (resolve) => {
            socket.emit(
              "call:invite",
              { conversationId: toId(conversationId), kind },
              resolve,
            );
          },
        );

        if (!ack.ok) {
          teardown(ack.error.message);
          return;
        }

        callId.current = ack.data.callId;
        connection(stream);

        setState({
          ...IDLE,
          phase: "calling",
          callId: ack.data.callId,
          conversationId,
          kind,
          outgoing: true,
        });

        ringTimer.current = setTimeout(() => {
          socket.emit("call:hangup", { callId: ack.data.callId });
        }, CALL_RING_MS);
      } catch {
        teardown("Your camera or microphone is not available.");
      }
    },
    [socket, state.phase, media, connection, teardown],
  );

  const accept = useCallback(async () => {
    const id = callId.current;
    if (socket === null || id === null) return;

    try {
      const stream = await media(state.kind);
      connection(stream);
      answeredHere.current = true;

      socket.emit("call:accept", { callId: id });
    } catch {
      socket.emit("call:decline", { callId: id });
      teardown("Your camera or microphone is not available.");
    }
  }, [socket, state.kind, media, connection, teardown]);

  const decline = useCallback(() => {
    const id = callId.current;
    if (id !== null) socket?.emit("call:decline", { callId: id });
    teardown(null);
  }, [socket, teardown]);

  const hangUp = useCallback(() => {
    const id = callId.current;
    if (id !== null) socket?.emit("call:hangup", { callId: id });
    teardown(null);
  }, [socket, teardown]);

  const toggleMute = useCallback(() => {
    const tracks = local.current?.getAudioTracks() ?? [];
    const next = tracks.every((track) => track.enabled);

    for (const track of tracks) track.enabled = !next;
    setState((current) => ({ ...current, muted: next }));
  }, []);

  const toggleCamera = useCallback(() => {
    const tracks = local.current?.getVideoTracks() ?? [];
    const next = tracks.every((track) => track.enabled);

    for (const track of tracks) track.enabled = !next;
    setState((current) => ({ ...current, cameraOff: next }));
  }, []);

  const useDevice = useCallback(
    async (kind: "audio" | "video", deviceId: string) => {
      const pc = peer.current;
      const stream = local.current;

      if (pc === null || stream === null) return;

      const fresh = await navigator.mediaDevices.getUserMedia(
        kind === "video"
          ? { video: { deviceId: { exact: deviceId } } }
          : { audio: { deviceId: { exact: deviceId } } },
      );

      const [replacement] = fresh.getTracks();
      if (replacement === undefined) return;

      const sender = pc
        .getSenders()
        .find((entry) => entry.track?.kind === replacement.kind);

      await sender?.replaceTrack(replacement);

      for (const old of stream.getTracks()) {
        if (old.kind !== replacement.kind) continue;

        stream.removeTrack(old);
        old.stop();
      }

      stream.addTrack(replacement);
      setLocalStream(new MediaStream(stream.getTracks()));
    },
    [],
  );

  const dismissNote = useCallback(() => {
    setState((current) => ({ ...current, note: null }));
  }, []);

  useEffect(() => {
    ringer.current ??= createRinger();
    const tones = ringer.current;

    if (state.phase === "ringing") tones.start("incoming");
    else if (state.phase === "calling") tones.start("outgoing");
    else tones.stop();

    return () => tones.stop();
  }, [state.phase]);

  useEffect(() => {
    if (socket === null) return;

    function onIncoming(payload: CallIncoming): void {
      if (callId.current !== null) {
        socket?.emit("call:decline", { callId: payload.callId });
        return;
      }

      callId.current = payload.callId;

      setState({
        ...IDLE,
        phase: "ringing",
        callId: payload.callId,
        conversationId: payload.conversationId,
        peerId: payload.callerId,
        kind: payload.kind,
        outgoing: false,
      });
    }

    function onAccepted({ callId: id }: CallIdEvent): void {
      if (callId.current !== id) return;

      if (!answeredHere.current && !state.outgoing) {
        teardown(null);
        return;
      }

      setState((current) => ({
        ...current,
        phase: "active",
        answeredAt: Date.now(),
      }));

      if (ringTimer.current !== null) {
        clearTimeout(ringTimer.current);
        ringTimer.current = null;
      }

      if (!state.outgoing) return;

      void (async () => {
        const pc = peer.current;
        if (pc === null) return;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket?.emit("call:sdp", {
          callId: id,
          description: { type: "offer", sdp: offer.sdp ?? "" },
        });
      })();
    }

    function onSdp({ callId: id, description }: CallSdpEvent): void {
      if (callId.current !== id) return;

      void (async () => {
        const pc = peer.current;
        if (pc === null) return;

        await pc.setRemoteDescription(description);
        await flushIce();

        if (description.type !== "offer") return;

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket?.emit("call:sdp", {
          callId: id,
          description: { type: "answer", sdp: answer.sdp ?? "" },
        });
      })();
    }

    function onIce({ callId: id, candidate }: CallIceEvent): void {
      if (callId.current !== id) return;

      const pc = peer.current;

      if (pc === null || pc.remoteDescription === null) {
        pendingIce.current.push(candidate);
        return;
      }

      void pc.addIceCandidate(candidate).catch(() => undefined);
    }

    function onEnded({ callId: id, status }: CallEnded): void {
      if (callId.current !== id) return;

      teardown(
        status === "declined"
          ? "Call declined"
          : status === "busy"
            ? "They are on another call"
            : status === "missed"
              ? "No answer"
              : null,
      );
    }

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:sdp", onSdp);
    socket.on("call:ice", onIce);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:sdp", onSdp);
      socket.off("call:ice", onIce);
      socket.off("call:ended", onEnded);
    };
  }, [socket, state.outgoing, teardown, flushIce]);

  const value = useMemo<CallContextValue>(
    () => ({
      state,
      localStream,
      remoteStream,
      start,
      accept,
      decline,
      hangUp,
      toggleMute,
      toggleCamera,
      useDevice,
      dismissNote,
    }),
    [
      state,
      localStream,
      remoteStream,
      start,
      accept,
      decline,
      hangUp,
      toggleMute,
      toggleCamera,
      useDevice,
      dismissNote,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
