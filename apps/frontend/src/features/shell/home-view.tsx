"use client";

import type { Me } from "@duplex/shared";
import { ArrowLeft, KeyRound, Palette, Radio } from "lucide-react";
import { useState } from "react";

import { BrandMark, TypingDots } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { AppShell } from "./app-shell";
import { Sidebar } from "./sidebar";

export function HomeView({ me }: { me: Me }) {
  const [openConversationId, setOpenConversationId] = useState<string | null>(
    null,
  );

  return (
    <AppShell
      detailOpen={openConversationId !== null}
      sidebar={<Sidebar me={me} />}
      detail={<EmptyConversation onBack={() => setOpenConversationId(null)} />}
      panel={<InfoPanel me={me} />}
    />
  );
}

const MILESTONES = [
  { icon: KeyRound, label: "Auth", tint: "bg-primary text-primary-foreground" },
  { icon: Palette, label: "Design system", tint: "bg-lemon text-ink" },
  { icon: Radio, label: "Realtime", tint: "bg-surface-raised text-muted-foreground" },
] as const;

function EmptyConversation({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-header shrink-0 items-center gap-2 border-b-2 border-hairline bg-background/80 px-3 backdrop-blur md:px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          <span className="sr-only">Back to conversations</span>
        </Button>
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
              Quiet in here — for now
            </h2>
            <p className="text-muted-foreground">
              You are signed in and the shell is live. Conversations plug into
              this exact layout next.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {MILESTONES.map((milestone, index) => (
              <span
                key={milestone.label}
                className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 font-display text-xs font-semibold shadow-sticker-sm ${milestone.tint}`}
                style={{ rotate: `${index % 2 === 0 ? -1.5 : 1.5}deg` }}
              >
                <milestone.icon className="size-3.5" />
                {milestone.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ me }: { me: Me }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-header shrink-0 items-center border-b-2 border-hairline px-4">
        <p className="font-display text-sm font-semibold">Your profile</p>
      </header>

      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <UserAvatar user={me} className="size-20 rounded-2xl shadow-sticker" online />
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold">{me.displayName}</p>
          <p className="text-xs text-muted-foreground">@{me.username}</p>
        </div>
        {me.bio !== null ? (
          <p className="text-sm text-muted-foreground">{me.bio}</p>
        ) : (
          <p className="text-sm text-muted-foreground/70">No bio yet.</p>
        )}
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-xl border-2 border-hairline bg-surface-raised p-3.5">
          <p className="mb-1.5 font-display text-xs font-semibold">
            How this session works
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A 15-minute access token kept in memory, refreshed silently from an
            httpOnly cookie. Close the tab and it picks up again.
          </p>
        </div>
      </div>
    </div>
  );
}
