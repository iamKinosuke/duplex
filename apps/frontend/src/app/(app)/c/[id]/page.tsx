"use client";

import { use } from "react";

import { ConversationView } from "@/features/conversation/conversation-view";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <ConversationView conversationId={id} />;
}
