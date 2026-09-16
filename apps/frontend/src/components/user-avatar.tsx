import type { User } from "@duplex/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const TINTS = [
  "bg-primary text-primary-foreground",
  "bg-teal text-teal-foreground",
  "bg-lemon text-ink",
  "bg-grape text-grape-foreground",
] as const;

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/u).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0)).join("");

  return letters === "" ? "?" : letters.toUpperCase();
}

function tintFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash + char.charCodeAt(0)) % 997;

  return TINTS[hash % TINTS.length] ?? TINTS[0];
}

export interface UserAvatarProps {
  user: Pick<User, "displayName" | "avatarUrl">;
  className?: string;
  online?: boolean;
}

export function UserAvatar({ user, className, online }: UserAvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar
        className={cn(
          "size-10 rounded-xl border-2 border-ink shadow-sticker-sm",
          className,
        )}
      >
        {user.avatarUrl !== null ? (
          <AvatarImage src={user.avatarUrl} alt="" className="rounded-[0.6rem]" />
        ) : null}
        <AvatarFallback
          className={cn(
            "rounded-[0.6rem] font-display text-xs font-bold",
            tintFor(user.displayName),
          )}
        >
          {initials(user.displayName)}
        </AvatarFallback>
      </Avatar>

      {online === true ? (
        <span className="absolute -right-1 -bottom-1 size-3.5 rounded-full border-2 border-ink bg-online" />
      ) : null}
    </span>
  );
}
