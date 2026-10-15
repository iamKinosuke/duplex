"use client";

import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useConversations } from "@/features/conversation/queries";
import { cn } from "@/lib/utils";
import { useCall } from "./call-provider";

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function Stream({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted: boolean;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.current === null) return;

    video.current.srcObject = stream;
  }, [stream]);

  return (
    <video ref={video} autoPlay playsInline muted={muted} className={className} />
  );
}

function Elapsed({ since }: { since: number }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const tick = () => setSeconds(Math.floor((Date.now() - since) / 1000));
    tick();

    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [since]);

  return <span className="tabular-nums">{clock(seconds)}</span>;
}

export function CallLayer() {
  const call = useCall();
  const conversations = useConversations();

  const { state } = call;

  useEffect(() => {
    if (state.phase !== "ringing") return;

    const original = document.title;
    let lit = false;

    const timer = setInterval(() => {
      lit = !lit;
      document.title = lit ? "📞 Incoming call" : original;
    }, 1_000);

    return () => {
      clearInterval(timer);
      document.title = original;
    };
  }, [state.phase]);

  useEffect(() => {
    if (state.note === null) return;

    const timer = setTimeout(call.dismissNote, 4_000);
    return () => clearTimeout(timer);
  }, [state.note, call.dismissNote]);

  if (state.phase === "idle") {
    return state.note === null ? null : (
      <p className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <span className="rounded-full border-2 border-ink bg-card px-4 py-2 font-display text-sm font-semibold shadow-sticker">
          {state.note}
        </span>
      </p>
    );
  }

  const room = (conversations.data ?? []).find(
    (item) => item.id === state.conversationId,
  );
  const peer = room?.peer ?? null;
  const title = peer?.displayName ?? "Someone";
  const video = state.kind === "video";
  const onCamera = video && state.phase === "active" && call.remoteStream !== null;

  const status =
    state.phase === "ringing"
      ? `Incoming ${video ? "video " : ""}call`
      : state.phase === "calling"
        ? "Calling…"
        : state.answeredAt === null
          ? "Connecting…"
          : null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink text-white">
      <Stream
        stream={call.remoteStream}
        muted={false}
        className={cn(
          "absolute inset-0 size-full object-cover",
          !onCamera && "hidden",
        )}
      />

      {onCamera ? null : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <UserAvatar
            user={peer ?? { displayName: title, avatarUrl: null }}
            className="size-20 rounded-2xl"
          />
          <div className="space-y-1">
            <p className="font-display text-xl font-semibold">{title}</p>
            <p className="text-sm opacity-70">
              {status ??
                (state.answeredAt === null ? null : (
                  <Elapsed since={state.answeredAt} />
                ))}
            </p>
          </div>
        </div>
      )}

      {onCamera ? (
        <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full border border-white/20 bg-ink/70 py-1.5 pr-3.5 pl-1.5 backdrop-blur">
          <UserAvatar
            user={peer ?? { displayName: title, avatarUrl: null }}
            className="size-7 rounded-full border-0 shadow-none"
          />
          <span className="font-display text-xs font-semibold">{title}</span>
          <span className="text-xs opacity-70">
            {state.answeredAt === null ? status : <Elapsed since={state.answeredAt} />}
          </span>
        </div>
      ) : null}

      {video && state.phase === "active" ? (
        <Stream
          stream={call.localStream}
          muted
          className="absolute right-4 bottom-24 aspect-video w-28 rounded-xl border-2 border-white/30 bg-black/50 object-cover sm:w-40"
        />
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-6">
        {state.phase === "ringing" ? (
          <>
            <Button
              size="icon-lg"
              variant="destructive"
              className="size-14 rounded-full"
              onClick={call.decline}
              aria-label="Decline"
            >
              <PhoneOff className="size-5" />
            </Button>
            <Button
              size="icon-lg"
              variant="teal"
              className="size-14 rounded-full"
              onClick={() => void call.accept()}
              aria-label="Answer"
            >
              <Phone className="size-5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon-lg"
              variant="outline"
              className="size-12 rounded-full"
              onClick={call.toggleMute}
              aria-label={state.muted ? "Unmute" : "Mute"}
            >
              {state.muted ? <MicOff /> : <Mic />}
            </Button>

            {video ? (
              <Button
                size="icon-lg"
                variant="outline"
                className="size-12 rounded-full"
                onClick={call.toggleCamera}
                aria-label={state.cameraOff ? "Turn camera on" : "Turn camera off"}
              >
                {state.cameraOff ? <VideoOff /> : <Video />}
              </Button>
            ) : null}

            <Button
              size="icon-lg"
              variant="destructive"
              className="size-14 rounded-full"
              onClick={call.hangUp}
              aria-label="Hang up"
            >
              <PhoneOff className="size-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
