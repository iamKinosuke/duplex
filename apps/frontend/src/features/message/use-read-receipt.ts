"use client";

import { useConversation } from "@/features/conversation/queries";
import { receiptFor, type Receipt } from "./read-receipt";

export function useReadReceipt(
  conversationId: string,
  myId: string,
  messageId: string | null,
): Receipt | null {
  const conversation = useConversation(conversationId);

  if (messageId === null || conversation.data === undefined) return null;

  return receiptFor(conversation.data, myId, messageId);
}
