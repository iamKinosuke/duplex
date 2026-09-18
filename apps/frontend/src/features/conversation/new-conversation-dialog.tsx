"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { FormAlert } from "@/features/auth/form-alert";
import { useIsOnline } from "@/features/presence/queries";
import { useOpenDirect, useUserSearch } from "./queries";

export function NewConversationDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const results = useUserSearch(debounced);
  const openDirect = useOpenDirect();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(timer);
  }, [term]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setTerm("");
      setDebounced("");
      setError(null);
    }
    setOpen(next);
  }

  async function start(userId: string) {
    setError(null);

    try {
      const conversation = await openDirect.mutateAsync(userId);
      setOpen(false);
      router.push(`/c/${conversation.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not open that chat.",
      );
    }
  }

  const people = results.data ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-2xl border-2 border-ink shadow-sticker-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Start a conversation
          </DialogTitle>
          <DialogDescription>
            Search by username or display name.
          </DialogDescription>
        </DialogHeader>

        {error !== null ? <FormAlert message={error} /> : null}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="mai, tuan, linh…"
            className="pl-10"
          />
        </div>

        <div className="max-h-72 min-h-24 space-y-1 overflow-y-auto">
          {results.isFetching && people.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : null}

          {!results.isFetching && debounced !== "" && people.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nobody matches “{debounced}”.
            </p>
          ) : null}

          {people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              pending={openDirect.isPending}
              onPick={() => void start(person.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({
  person,
  pending,
  onPick,
}: {
  person: { id: string; username: string; displayName: string; avatarUrl: string | null };
  pending: boolean;
  onPick: () => void;
}) {
  const online = useIsOnline(person.id);

  return (
    <Button
      variant="ghost"
      onClick={onPick}
      disabled={pending}
      className="h-auto w-full justify-start gap-3 rounded-xl px-2.5 py-2"
    >
      <UserAvatar user={person} online={online} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-display text-sm font-semibold">
          {person.displayName}
        </span>
        <span className="block truncate text-xs font-normal text-muted-foreground">
          @{person.username}
        </span>
      </span>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
    </Button>
  );
}
