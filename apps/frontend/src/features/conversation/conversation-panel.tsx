"use client";

import type { ConversationDetail, Member } from "@duplex/shared";
import { Crown, EllipsisVertical, LogOut, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/features/auth/session";
import { FormAlert } from "@/features/auth/form-alert";
import { useIsOnline } from "@/features/presence/queries";
import { PeoplePicker } from "./people-picker";
import {
  useAddMembers,
  useConversation,
  useLeaveConversation,
  useRemoveMember,
  useTransferOwner,
} from "./queries";

function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ConversationPanel({
  conversationId,
}: {
  conversationId: string;
}) {
  const session = useSession();
  const conversation = useConversation(conversationId);

  if (conversation.isPending) {
    return (
      <PanelFrame>
        <div className="space-y-3 p-6">
          <Skeleton className="mx-auto size-20 rounded-2xl" />
          <Skeleton className="mx-auto h-5 w-32 rounded-lg" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </PanelFrame>
    );
  }

  if (conversation.data === undefined || session.data == null) {
    return (
      <PanelFrame>
        <p className="p-6 text-center text-sm text-muted-foreground">
          This conversation is not available.
        </p>
      </PanelFrame>
    );
  }

  return conversation.data.type === "direct" ? (
    <DirectDetails conversation={conversation.data} />
  ) : (
    <GroupDetails
      conversation={conversation.data}
      myId={session.data.id}
    />
  );
}

function PanelFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-header shrink-0 items-center border-b-2 border-hairline px-4">
        <p className="font-display text-sm font-semibold">Details</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function DirectDetails({ conversation }: { conversation: ConversationDetail }) {
  const peer = conversation.peer;
  const online = useIsOnline(peer?.id);

  return (
    <PanelFrame>
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <UserAvatar
          user={peer ?? { displayName: "Conversation", avatarUrl: null }}
          className="size-20 rounded-2xl shadow-sticker"
          online={online}
        />
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold">
            {peer?.displayName ?? "Conversation"}
          </p>
          {peer !== null ? (
            <p className="text-xs text-muted-foreground">@{peer.username}</p>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {peer?.bio ?? (online ? "Online right now." : "Offline.")}
        </p>
      </div>

      <p className="px-6 text-center text-2xs text-muted-foreground">
        Talking since {dayOf(conversation.createdAt)}
      </p>
    </PanelFrame>
  );
}

function GroupDetails({
  conversation,
  myId,
}: {
  conversation: ConversationDetail;
  myId: string;
}) {
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addMembers = useAddMembers(conversation.id);
  const removeMember = useRemoveMember(conversation.id);
  const transferOwner = useTransferOwner(conversation.id);
  const leave = useLeaveConversation(conversation.id);

  const iAmOwner = conversation.myRole === "owner";
  const memberIds = new Set(conversation.members.map((member) => member.user.id));

  function report(cause: unknown, fallback: string) {
    setError(cause instanceof Error ? cause.message : fallback);
  }

  async function add(userId: string) {
    setError(null);

    try {
      await addMembers.mutateAsync([userId]);
    } catch (cause) {
      report(cause, "Could not add them.");
    }
  }

  async function remove(member: Member) {
    setError(null);

    try {
      await removeMember.mutateAsync(member.user.id);
      setRemoving(null);
    } catch (cause) {
      report(cause, "Could not remove them.");
    }
  }

  async function promote(member: Member) {
    setError(null);

    try {
      await transferOwner.mutateAsync(member.user.id);
    } catch (cause) {
      report(cause, "Could not hand over the group.");
    }
  }

  async function walkAway() {
    setError(null);

    try {
      await leave.mutateAsync(myId);
      setLeaving(false);
      router.replace("/");
    } catch (cause) {
      report(cause, "Could not leave the group.");
    }
  }

  return (
    <PanelFrame>
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <UserAvatar
          user={{
            displayName: conversation.name ?? "Group",
            avatarUrl: conversation.avatarUrl,
          }}
          className="size-20 rounded-2xl shadow-sticker"
        />
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold">
            {conversation.name ?? "Group"}
          </p>
          <p className="text-xs text-muted-foreground">
            {conversation.memberCount} members · since{" "}
            {dayOf(conversation.createdAt)}
          </p>
        </div>
      </div>

      {error !== null ? (
        <div className="px-4 pb-3">
          <FormAlert message={error} />
        </div>
      ) : null}

      <div className="flex items-center justify-between px-4 pb-2">
        <p className="font-display text-xs font-semibold text-muted-foreground uppercase">
          Members
        </p>

        {iAmOwner ? (
          <Button size="xs" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus />
            Add
          </Button>
        ) : null}
      </div>

      <ul className="space-y-1 px-2">
        {conversation.members.map((member) => (
          <li key={member.user.id}>
            <MemberRow
              member={member}
              isMe={member.user.id === myId}
              canManage={iAmOwner && member.user.id !== myId}
              onPromote={() => void promote(member)}
              onRemove={() => setRemoving(member)}
            />
          </li>
        ))}
      </ul>

      <div className="p-4">
        {iAmOwner ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button variant="outline" className="w-full" disabled>
                  <LogOut />
                  Leave group
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Hand the group to someone else first
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLeaving(true)}
          >
            <LogOut />
            Leave group
          </Button>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="rounded-2xl border-2 border-ink shadow-sticker-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Add people
            </DialogTitle>
            <DialogDescription>
              They will see the whole history of this group.
            </DialogDescription>
          </DialogHeader>

          <PeoplePicker
            exclude={memberIds}
            busy={addMembers.isPending}
            onPick={(person) => void add(person.id)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        title="Remove from group?"
        description={
          <>
            {removing?.user.displayName} loses the room and its whole history.
            This cannot be undone.
          </>
        }
        confirmLabel="Remove"
        pending={removeMember.isPending}
        onConfirm={() => {
          if (removing !== null) void remove(removing);
        }}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      />

      <ConfirmDialog
        open={leaving}
        title="Leave this group?"
        description="You lose the room and its whole history. This cannot be undone."
        confirmLabel="Leave"
        pending={leave.isPending}
        onConfirm={() => void walkAway()}
        onOpenChange={setLeaving}
      />
    </PanelFrame>
  );
}

function MemberRow({
  member,
  isMe,
  canManage,
  onPromote,
  onRemove,
}: {
  member: Member;
  isMe: boolean;
  canManage: boolean;
  onPromote: () => void;
  onRemove: () => void;
}) {
  const online = useIsOnline(member.user.id);

  return (
    <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-surface-raised">
      <UserAvatar user={member.user} online={online} className="size-9" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-sm font-semibold">
            {member.user.displayName}
            {isMe ? " (you)" : ""}
          </span>
          {member.role === "owner" ? (
            <Crown className="size-3.5 shrink-0 text-lemon" />
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          @{member.user.username}
        </span>
      </span>

      {canManage ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <EllipsisVertical className="size-4" />
              <span className="sr-only">Manage {member.user.displayName}</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-52 rounded-xl border-2 border-ink shadow-sticker"
          >
            <DropdownMenuItem
              className="cursor-pointer rounded-lg font-medium"
              onSelect={onPromote}
            >
              <Crown className="size-4" />
              Make owner
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg font-medium"
              onSelect={onRemove}
            >
              <LogOut className="size-4" />
              Remove from group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
