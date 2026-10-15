import type { CallKind, CallStatus } from "@duplex/shared";

import {
  CallKind as PrismaCallKind,
  CallStatus as PrismaCallStatus,
} from "../generated/prisma/client.js";

const TO_PRISMA_KIND: Record<CallKind, PrismaCallKind> = {
  audio: PrismaCallKind.AUDIO,
  video: PrismaCallKind.VIDEO,
};

const TO_PRISMA_STATUS: Record<CallStatus, PrismaCallStatus> = {
  missed: PrismaCallStatus.MISSED,
  declined: PrismaCallStatus.DECLINED,
  ended: PrismaCallStatus.ENDED,
  busy: PrismaCallStatus.BUSY,
};

export function fromCallKind(kind: CallKind): PrismaCallKind {
  return TO_PRISMA_KIND[kind];
}

export function fromCallStatus(status: CallStatus): PrismaCallStatus {
  return TO_PRISMA_STATUS[status];
}

export function callSummary(
  kind: CallKind,
  status: CallStatus,
  seconds: number,
): string {
  const noun = kind === "video" ? "Video call" : "Call";

  if (status === "ended") {
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, "0");

    return `${noun} · ${minutes}:${rest}`;
  }

  if (status === "declined") return `${noun} declined`;

  return `Missed ${noun.toLowerCase()}`;
}
