"use client";

import type { User } from "@duplex/shared";
import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useIsOnline } from "@/features/presence/queries";
import { useUserSearch } from "./queries";

export function PeoplePicker({
  placeholder = "mai, tuan, linh…",
  exclude,
  selected,
  busy = false,
  onPick,
}: {
  placeholder?: string;
  exclude?: ReadonlySet<string>;
  selected?: ReadonlySet<string>;
  busy?: boolean;
  onPick: (person: User) => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useUserSearch(debounced);
  const people = (results.data ?? []).filter(
    (person) => exclude?.has(person.id) !== true,
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>

      <div className="max-h-64 min-h-24 space-y-1 overflow-y-auto">
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
            picked={selected?.has(person.id) === true}
            busy={busy}
            onPick={() => onPick(person)}
          />
        ))}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  picked,
  busy,
  onPick,
}: {
  person: User;
  picked: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  const online = useIsOnline(person.id);

  return (
    <Button
      variant="ghost"
      onClick={onPick}
      disabled={busy}
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

      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {picked ? <Check className="size-4 text-primary" /> : null}
    </Button>
  );
}
