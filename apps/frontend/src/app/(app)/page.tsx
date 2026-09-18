"use client";

import { MessageCircle } from "lucide-react";

import { BrandMark, TypingDots } from "@/components/brand";

export default function NoConversationPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="hidden h-header shrink-0 items-center border-b-2 border-hairline px-4 md:flex">
        <p className="font-display text-sm font-semibold text-muted-foreground">
          No conversation open
        </p>
      </header>

      <div className="grid flex-1 place-items-center p-8">
        <div className="max-w-md animate-pop-in space-y-6 text-center">
          <div className="relative mx-auto w-fit">
            <BrandMark className="size-16 rotate-3 [&_svg]:size-9" />
            <span
              className="absolute -right-5 -bottom-3 flex items-center rounded-bubble rounded-bl-md border-2 border-ink bg-card px-3 py-2 text-foreground shadow-sticker-sm"
              style={{ rotate: "-4deg" }}
            >
              <TypingDots />
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-semibold">
              Pick someone to talk to
            </h2>
            <p className="text-muted-foreground">
              Choose a conversation on the left, or start a new one with the
              pencil button.
            </p>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <MessageCircle className="size-3.5" />
            Messages arrive live over a socket
          </p>
        </div>
      </div>
    </div>
  );
}
