import type { ReactNode } from "react";

import { BrandWordmark, TypingDots } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { RequireGuest } from "@/features/auth/auth-gate";

const BUBBLES = [
  { text: "Does the video call work on 4G?", side: "in" as const, tilt: "-1.5deg" },
  { text: "It does — there is a TURN server behind it.", side: "out" as const, tilt: "1.5deg" },
  { text: "Nice 🎉", side: "in" as const, tilt: "-1deg" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_minmax(26rem,32rem)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface p-10 lg:flex">
        <div className="dotted-grid pointer-events-none absolute inset-0 opacity-60" />
        <div
          className="pointer-events-none absolute -top-24 -left-20 size-72 animate-float rounded-full bg-primary/25 blur-2xl"
          style={{ ["--tilt" as string]: "0deg" }}
        />
        <div
          className="pointer-events-none absolute right-10 bottom-32 size-56 animate-float rounded-full bg-teal/20 blur-2xl"
          style={{ animationDelay: "1.4s" }}
        />

        <BrandWordmark className="relative" />

        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <span className="inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-ink bg-lemon px-3 py-1 font-display text-xs font-semibold text-ink shadow-sticker-sm">
              Self-hosted · no SaaS
            </span>
            <h2 className="font-display text-4xl leading-tight font-semibold">
              Chat that moves,
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">calls that land.</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-3 -rotate-1 bg-primary/45" />
              </span>
            </h2>
            <p className="max-w-md text-muted-foreground">
              Group rooms, read receipts, presence and 1:1 video — all running on
              one small VPS, not on someone else&apos;s API.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {BUBBLES.map((bubble) => (
              <div
                key={bubble.text}
                className={
                  bubble.side === "out"
                    ? "ml-auto max-w-[20rem] rounded-bubble rounded-br-md border-2 border-ink bg-bubble-out px-4 py-2.5 font-medium text-bubble-out-foreground shadow-sticker-sm"
                    : "max-w-[20rem] rounded-bubble rounded-bl-md border-2 border-ink bg-bubble-in px-4 py-2.5 font-medium text-bubble-in-foreground shadow-sticker-sm"
                }
                style={{ rotate: bubble.tilt }}
              >
                {bubble.text}
              </div>
            ))}

            <div
              className="flex w-fit items-center gap-2 rounded-bubble rounded-bl-md border-2 border-ink bg-bubble-in px-4 py-3 text-bubble-in-foreground shadow-sticker-sm"
              style={{ rotate: "-0.5deg" }}
            >
              <TypingDots />
              <span className="text-xs text-muted-foreground">typing…</span>
            </div>
          </div>
        </div>

        <p className="relative font-display text-xs font-medium text-muted-foreground">
          nginx · PM2 · MySQL · Redis · coturn
        </p>
      </aside>

      <main className="flex flex-col">
        <header className="flex items-center justify-between px-6 py-5 lg:justify-end">
          <BrandWordmark className="lg:hidden" />
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm animate-pop-in">
            <RequireGuest>{children}</RequireGuest>
          </div>
        </div>
      </main>
    </div>
  );
}
