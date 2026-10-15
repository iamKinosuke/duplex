import {
  CallKind,
  CallStatus,
  type PrismaClient,
} from "../generated/prisma/client.js";

export interface StartCallInput {
  callId: string;
  conversationId: bigint;
  callerId: bigint;
  kind: CallKind;
}

export interface CallRepository {
  start(input: StartCallInput): Promise<void>;
  finish(callId: string, status: CallStatus, endedAt: Date): Promise<void>;
}

export function createCallRepository(client: PrismaClient): CallRepository {
  return {
    async start(input) {
      await client.callLog.create({
        data: {
          callId: input.callId,
          conversationId: input.conversationId,
          callerId: input.callerId,
          kind: input.kind,
          status: CallStatus.MISSED,
        },
      });
    },

    async finish(callId, status, endedAt) {
      await client.callLog.updateMany({
        where: { callId },
        data: { status, endedAt },
      });
    },
  };
}
