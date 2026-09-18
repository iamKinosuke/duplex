"use client";

import type { Me } from "@duplex/shared";
import { ShieldCheck } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";

export function InfoPanel({ me }: { me: Me }) {
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
        <div className="flex items-start gap-2.5 rounded-xl border-2 border-hairline bg-surface-raised p-3.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-online" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Messages travel over a socket authenticated by a 15-minute access
            token, refreshed silently from an httpOnly cookie.
          </p>
        </div>
      </div>
    </div>
  );
}
