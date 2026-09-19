import type { ConversationDetail, Message } from "@duplex/shared";

export interface BubbleMeta {
  kind: "system" | "bubble";
  mine: boolean;
  startsRun: boolean;
  endsRun: boolean;
  senderName: string | null;
}

function runBreaks(here: Message, there: Message | undefined): boolean {
  if (there === undefined) return true;
  if (here.type === "system" || there.type === "system") return true;

  return here.senderId !== there.senderId;
}

export function metaFor(
  messages: Message[],
  index: number,
  myId: string,
  conversation: ConversationDetail | null,
): BubbleMeta | null {
  const message = messages[index];
  if (message === undefined) return null;

  const mine = message.senderId === myId;
  const startsRun = runBreaks(message, messages[index - 1]);
  const endsRun = runBreaks(message, messages[index + 1]);

  if (message.type === "system") {
    return { kind: "system", mine, startsRun, endsRun, senderName: null };
  }

  const named =
    conversation !== null &&
    conversation.type === "group" &&
    !mine &&
    startsRun;

  const senderName = named
    ? (conversation.members.find(
        (member) => member.user.id === message.senderId,
      )?.user.displayName ?? null)
    : null;

  return { kind: "bubble", mine, startsRun, endsRun, senderName };
}
