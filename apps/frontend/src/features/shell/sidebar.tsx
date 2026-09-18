"use client";

import type { Me } from "@duplex/shared";
import { LogOut, Search, SquarePen, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { BrandWordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConversationList } from "@/features/conversation/conversation-list";
import { NewConversationDialog } from "@/features/conversation/new-conversation-dialog";
import { useLogout } from "@/features/auth/session";
import { ProfileDialog } from "@/features/profile/profile-dialog";

export function Sidebar({ me }: { me: Me }) {
  const router = useRouter();
  const logout = useLogout();

  async function signOut() {
    await logout.mutateAsync();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-header shrink-0 items-center justify-between gap-2 border-b-2 border-hairline px-4">
        <BrandWordmark />

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <NewConversationDialog>
                <Button variant="ghost" size="icon-sm">
                  <SquarePen className="size-4" />
                  <span className="sr-only">New conversation</span>
                </Button>
              </NewConversationDialog>
            </TooltipTrigger>
            <TooltipContent>Start a conversation</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="shrink-0 px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search conversations" className="pl-10" disabled />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <ConversationList />
      </div>

      <footer className="shrink-0 border-t-2 border-hairline p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-transparent px-2 py-2 text-left transition-colors duration-(--duration-fast) hover:border-hairline hover:bg-surface-raised focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <UserAvatar user={me} online />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-semibold">
                  {me.displayName}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  @{me.username}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="top"
            className="w-64 rounded-xl border-2 border-ink shadow-sticker"
          >
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {me.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <ProfileDialog me={me}>
              <DropdownMenuItem
                onSelect={(event) => event.preventDefault()}
                className="cursor-pointer rounded-lg font-medium"
              >
                <UserRound className="size-4" />
                Edit profile
              </DropdownMenuItem>
            </ProfileDialog>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg font-medium"
              onSelect={() => {
                void signOut();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </footer>
    </div>
  );
}
