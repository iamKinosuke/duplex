import { randomUUID } from "node:crypto";

import type { CallKind, CallStatus, Message } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import { ConversationType } from "../generated/prisma/client.js";
import type { CallRecord, CallStore } from "../realtime/calls.js";
import type { PresenceTracker } from "../realtime/presence.js";
import type { CallRepository } from "../repositories/call.repository.js";
import type { ConversationRepository } from "../repositories/conversation.repository.js";
import {
  callSummary,
  fromCallKind,
  fromCallStatus,
} from "../utils/call.serialize.js";
import { toMessage } from "../utils/message.serialize.js";
import { toBigInt } from "../utils/serialize.js";

export interface CallServiceDeps {
  conversations: ConversationRepository;
  calls: CallRepository;
  store: CallStore;
  presence: PresenceTracker;
}

export interface InviteRequest {
  callerId: bigint;
  conversationId: bigint;
  kind: CallKind;
}

export interface CallClosed {
  record: CallRecord;
  status: CallStatus;
  systemMessage: Message;
}

export type InviteResult =
  | { outcome: "ringing"; record: CallRecord }
  | { outcome: "refused"; status: CallStatus; closed: CallClosed | null };

export interface CallService {
  invite(request: InviteRequest): Promise<InviteResult>;
  accept(callId: string, userId: string): Promise<CallRecord>;
  decline(callId: string, userId: string): Promise<CallClosed | null>;
  hangUp(callId: string, userId: string): Promise<CallClosed | null>;
  relay(callId: string, userId: string): Promise<CallRecord>;
  dropFor(userId: string): Promise<CallClosed | null>;
}

const NOT_FOUND = "That conversation does not exist.";
const NO_CALL = "That call is over.";

export function createCallService(deps: CallServiceDeps): CallService {
  async function close(
    record: CallRecord,
    status: CallStatus,
  ): Promise<CallClosed> {
    const endedAt = new Date();
    const seconds =
      record.answeredAt === null
        ? 0
        : Math.max(
            0,
            Math.round(
              (endedAt.getTime() - new Date(record.answeredAt).getTime()) / 1000,
            ),
          );

    const settled: CallStatus =
      status === "ended" && record.answeredAt === null ? "missed" : status;

    await deps.calls.finish(
      record.callId,
      fromCallStatus(settled),
      endedAt,
    );

    const row = await deps.conversations.appendSystemMessage(
      toBigInt(record.conversationId),
      toBigInt(record.callerId),
      callSummary(record.kind, settled, seconds),
    );

    return {
      record,
      status: settled,
      systemMessage: toMessage(row, toBigInt(record.callerId)),
    };
  }

  function participant(record: CallRecord, userId: string): boolean {
    return record.callerId === userId || record.calleeId === userId;
  }

  return {
    async invite({ callerId, conversationId, kind }) {
      const row = await deps.conversations.findForMember(
        conversationId,
        callerId,
      );

      if (row === null) throw AppError.notFound(NOT_FOUND);

      if (row.type !== ConversationType.DIRECT) {
        throw AppError.badRequest("Calls are one to one for now.");
      }

      const peer = row.members.find((member) => member.userId !== callerId);

      if (peer === undefined) {
        throw AppError.badRequest("There is nobody to call here.");
      }

      const record: CallRecord = {
        callId: randomUUID(),
        callerId: callerId.toString(),
        calleeId: peer.userId.toString(),
        conversationId: conversationId.toString(),
        kind,
        state: "ringing",
        startedAt: new Date().toISOString(),
        answeredAt: null,
      };

      await deps.calls.start({
        callId: record.callId,
        conversationId,
        callerId,
        kind: fromCallKind(kind),
      });

      const online = await deps.presence.onlineAmong([record.calleeId]);

      if (online.length === 0) {
        return {
          outcome: "refused",
          status: "missed",
          closed: await close(record, "missed"),
        };
      }

      const claim = await deps.store.claim(record);

      if (claim !== "claimed") {
        return {
          outcome: "refused",
          status: "busy",
          closed: await close(record, "busy"),
        };
      }

      return { outcome: "ringing", record };
    },

    async accept(callId, userId) {
      const record = await deps.store.find(callId);

      if (record === null) throw AppError.notFound(NO_CALL);

      if (record.calleeId !== userId) {
        throw AppError.forbidden("Only the person being called can answer.");
      }

      const answered = await deps.store.answer(
        callId,
        new Date().toISOString(),
      );

      if (answered === null) throw AppError.notFound(NO_CALL);

      return answered;
    },

    async decline(callId, userId) {
      const record = await deps.store.find(callId);

      if (record === null) return null;

      if (record.calleeId !== userId) {
        throw AppError.forbidden("Only the person being called can decline.");
      }

      const released = await deps.store.release(callId);
      if (released === null) return null;

      return await close(released, "declined");
    },

    async hangUp(callId, userId) {
      const record = await deps.store.find(callId);

      if (record === null) return null;

      if (!participant(record, userId)) {
        throw AppError.forbidden("You are not in that call.");
      }

      const released = await deps.store.release(callId);
      if (released === null) return null;

      return await close(released, "ended");
    },

    async relay(callId, userId) {
      const record = await deps.store.find(callId);

      if (record === null) throw AppError.notFound(NO_CALL);

      if (!participant(record, userId)) {
        throw AppError.forbidden("You are not in that call.");
      }

      return record;
    },

    async dropFor(userId) {
      const callId = await deps.store.activeOf(userId);

      if (callId === null) return null;

      const released = await deps.store.release(callId);
      if (released === null) return null;

      return await close(released, "ended");
    },
  };
}
