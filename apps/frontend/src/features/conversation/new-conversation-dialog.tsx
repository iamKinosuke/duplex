"use client";

import { LIMITS, type User } from "@duplex/shared";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/features/auth/form-alert";
import { cn } from "@/lib/utils";
import { PeoplePicker } from "./people-picker";
import { useCreateGroup, useOpenDirect } from "./queries";

type Mode = "chat" | "group";

export function NewConversationDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [picked, setPicked] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const openDirect = useOpenDirect();
  const createGroup = useCreateGroup();

  function handleOpenChange(next: boolean) {
    if (next) {
      setMode("chat");
      setPicked([]);
      setName("");
      setError(null);
    }
    setOpen(next);
  }

  function goTo(conversationId: string) {
    setOpen(false);
    router.push(`/c/${conversationId}`);
  }

  function toMessage(cause: unknown, fallback: string): string {
    return cause instanceof Error ? cause.message : fallback;
  }

  async function pick(person: User) {
    if (mode === "group") {
      setPicked((current) =>
        current.some((entry) => entry.id === person.id)
          ? current.filter((entry) => entry.id !== person.id)
          : [...current, person],
      );
      return;
    }

    setError(null);

    try {
      goTo((await openDirect.mutateAsync(person.id)).id);
    } catch (cause) {
      setError(toMessage(cause, "Could not open that chat."));
    }
  }

  async function create() {
    setError(null);

    try {
      const conversation = await createGroup.mutateAsync({
        name: name.trim(),
        memberIds: picked.map((person) => person.id),
      });

      goTo(conversation.id);
    } catch (cause) {
      setError(toMessage(cause, "Could not create that group."));
    }
  }

  const grouping = mode === "group";
  const selected = new Set(picked.map((person) => person.id));

  const ready =
    picked.length > 0 &&
    name.trim().length >= LIMITS.groupName.min &&
    name.trim().length <= LIMITS.groupName.max;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-2xl border-2 border-ink shadow-sticker-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Start a conversation
          </DialogTitle>
          <DialogDescription>
            {grouping
              ? "Pick everyone who belongs in the room, then name it."
              : "Search by username or display name."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-xl border-2 border-hairline bg-surface-raised p-1">
          {(
            [
              ["chat", "Chat"],
              ["group", "Group"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-3 py-1.5 font-display text-sm font-semibold transition-colors duration-(--duration-fast)",
                mode === value
                  ? "border-2 border-ink bg-card shadow-sticker-sm"
                  : "border-2 border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {error !== null ? <FormAlert message={error} /> : null}

        {grouping && picked.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {picked.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => void pick(person)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-hairline bg-surface-raised py-1 pr-1.5 pl-2 text-xs font-medium hover:border-ink"
                >
                  {person.displayName}
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <PeoplePicker
          selected={grouping ? selected : undefined}
          busy={openDirect.isPending}
          onPick={(person) => void pick(person)}
        />

        {grouping ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(event) =>
                  setName(event.target.value.slice(0, LIMITS.groupName.max))
                }
                placeholder="Weekend plans"
              />
            </div>

            <DialogFooter>
              <Button
                onClick={() => void create()}
                disabled={!ready || createGroup.isPending}
              >
                {createGroup.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Create group
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

