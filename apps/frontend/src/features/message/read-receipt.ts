import type { ConversationDetail } from "@duplex/shared";

export interface Receipt {
  kind: "direct" | "group";
  readers: number;
}

export function receiptFor(
  conversation: ConversationDetail,
  myId: string,
  messageId: string,
): Receipt | null {
  const target = BigInt(messageId);

  const readers = conversation.members.filter(
    (member) =>
      member.user.id !== myId && BigInt(member.lastReadMessageId) >= target,
  ).length;

  return readers === 0 ? null : { kind: conversation.type, readers };
}

export function receiptLabel(receipt: Receipt): string {
  return receipt.kind === "direct" ? "Seen" : `Seen by ${receipt.readers}`;
}
