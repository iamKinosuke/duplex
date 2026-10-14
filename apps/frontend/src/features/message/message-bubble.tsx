"use client";

import {
  REACTION_EMOJIS,
  type Message,
  type ReactionEmoji,
  type ReplyPreview,
  type User,
} from "@duplex/shared";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Reply,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { PendingMessage } from "./queries";

function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface BubbleActions {
  onReply: (message: Message) => void;
  onJump: (messageId: string) => void;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
  onDelete: (message: Message) => void;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (messageId: string, body: string) => void;
}

export function SystemMessage({ message }: { message: Message }) {
  return (
    <p className="flex justify-center py-1">
      <span className="rounded-full border-2 border-hairline bg-surface-raised px-3 py-1 text-center text-2xs text-muted-foreground">
        {message.body}
      </span>
    </p>
  );
}

export function MessageBubble({
  message,
  mine,
  showTail,
  senderName,
  avatar,
  gutter = false,
  replyAuthor,
  highlighted = false,
  editing = false,
  busy = false,
  actions,
}: {
  message: Message;
  mine: boolean;
  showTail: boolean;
  senderName?: string | null;
  avatar?: Pick<User, "displayName" | "avatarUrl"> | null;
  gutter?: boolean;
  replyAuthor?: string | null;
  highlighted?: boolean;
  editing?: boolean;
  busy?: boolean;
  actions?: BubbleActions;
}) {
  const deleted = message.deletedAt !== null;

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group flex items-end gap-2",
        mine ? "justify-end" : "justify-start",
      )}
    >
      {gutter && !mine ? (
        <span className="w-8 shrink-0">
          {avatar != null ? (
            <UserAvatar user={avatar} className="size-8 rounded-lg" />
          ) : null}
        </span>
      ) : null}

      <div className="flex max-w-[min(32rem,78%)] min-w-0 flex-col gap-1">
        <div
          className={cn(
            "rounded-bubble border-2 border-ink px-3.5 py-2 shadow-sticker-sm transition-shadow duration-(--duration-normal)",
            mine
              ? "bg-bubble-out text-bubble-out-foreground"
              : "bg-bubble-in text-bubble-in-foreground",
            showTail && (mine ? "rounded-br-md" : "rounded-bl-md"),
            highlighted && "ring-[3px] ring-primary/60",
          )}
        >
          {senderName != null ? (
            <p className="mb-0.5 font-display text-2xs font-semibold opacity-70">
              {senderName}
            </p>
          ) : null}

          {message.replyTo !== null && !deleted ? (
            <ReplyQuote
              preview={message.replyTo}
              author={replyAuthor ?? null}
              onJump={() => actions?.onJump(message.replyTo?.id ?? "")}
            />
          ) : null}

          {editing && actions !== undefined ? (
            <InlineEditor
              body={message.body ?? ""}
              busy={busy}
              onCancel={actions.onCancelEdit}
              onSubmit={(body) => actions.onSubmitEdit(message.id, body)}
            />
          ) : (
            <p
              className={cn(
                "break-words whitespace-pre-wrap",
                deleted && "italic opacity-60",
              )}
            >
              {deleted ? "This message was deleted" : message.body}
            </p>
          )}

          <span className="mt-0.5 flex items-center justify-end gap-1 text-2xs opacity-70">
            {message.editedAt !== null && !deleted ? <span>edited</span> : null}
            {clockOf(message.createdAt)}
          </span>
        </div>

        {message.reactions.length > 0 && actions !== undefined ? (
          <ReactionChips
            message={message}
            mine={mine}
            onReact={actions.onReact}
          />
        ) : null}
      </div>

      {actions !== undefined && !deleted && !editing ? (
        <MessageActions
          message={message}
          mine={mine}
          actions={actions}
          className={cn(mine && "order-first")}
        />
      ) : null}
    </div>
  );
}

function ReplyQuote({
  preview,
  author,
  onJump,
}: {
  preview: ReplyPreview;
  author: string | null;
  onJump: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="mb-1 flex w-full cursor-pointer flex-col items-start rounded-lg border-l-4 border-ink/40 bg-ink/5 px-2 py-1 text-left"
    >
      <span className="font-display text-2xs font-semibold opacity-80">
        {author ?? "Someone"}
      </span>
      <span className="line-clamp-2 text-2xs opacity-70">
        {preview.deleted ? "This message was deleted" : preview.body}
      </span>
    </button>
  );
}

function ReactionChips({
  message,
  mine,
  onReact,
}: {
  message: Message;
  mine: boolean;
  onReact: (messageId: string, emoji: ReactionEmoji) => void;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", mine && "justify-end")}>
      {message.reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onReact(message.id, reaction.emoji)}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-full border-2 px-1.5 py-0.5 text-2xs transition-colors duration-(--duration-fast)",
            reaction.mine
              ? "border-ink bg-card font-semibold"
              : "border-hairline bg-surface-raised hover:border-ink",
          )}
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}

function MessageActions({
  message,
  mine,
  actions,
  className,
}: {
  message: Message;
  mine: boolean;
  actions: BubbleActions;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            "opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
            className,
          )}
        >
          <MoreHorizontal />
          <span className="sr-only">Message actions</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={mine ? "end" : "start"}
        className="w-52 rounded-xl border-2 border-ink shadow-sticker"
      >
        <div className="flex items-center justify-between gap-1 p-1">
          {REACTION_EMOJIS.map((emoji) => (
            <DropdownMenuItem
              key={emoji}
              className="size-7 shrink-0 cursor-pointer justify-center rounded-lg p-0 text-base"
              onSelect={() => actions.onReact(message.id, emoji)}
            >
              {emoji}
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="cursor-pointer rounded-lg font-medium"
          onSelect={() => actions.onReply(message)}
        >
          <Reply className="size-4" />
          Reply
        </DropdownMenuItem>

        {mine ? (
          <>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg font-medium"
              onSelect={() => actions.onStartEdit(message.id)}
            >
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer rounded-lg font-medium"
              onSelect={() => actions.onDelete(message)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineEditor({
  body,
  busy,
  onCancel,
  onSubmit,
}: {
  body: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: string) => void;
}) {
  const [draft, setDraft] = useState(body);
  const trimmed = draft.trim();

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (trimmed !== "") onSubmit(trimmed);
    }
  }

  return (
    <div className="space-y-1.5">
      <textarea
        autoFocus
        rows={2}
        value={draft}
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-full resize-none rounded-lg border-2 border-ink/30 bg-card px-2 py-1.5 text-foreground outline-none focus-visible:border-ink"
      />

      <div className="flex items-center justify-end gap-1.5">
        <Button size="xs" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="xs"
          onClick={() => onSubmit(trimmed)}
          disabled={busy || trimmed === ""}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

export function PendingBubble({
  pending,
  onRetry,
}: {
  pending: PendingMessage;
  onRetry: () => void;
}) {
  const failed = pending.status === "failed";

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[min(32rem,78%)] flex-col items-end gap-1">
        <div
          className={cn(
            "rounded-bubble rounded-br-md border-2 border-ink px-3.5 py-2 shadow-sticker-sm",
            failed
              ? "border-destructive/60 bg-destructive/10 text-foreground"
              : "bg-bubble-out text-bubble-out-foreground opacity-70",
          )}
        >
          {pending.replyTo !== null ? (
            <span className="mb-1 flex flex-col rounded-lg border-l-4 border-ink/40 bg-ink/5 px-2 py-1">
              <span className="line-clamp-2 text-2xs opacity-70">
                {pending.replyTo.deleted
                  ? "This message was deleted"
                  : pending.replyTo.body}
              </span>
            </span>
          ) : null}

          <p className="break-words whitespace-pre-wrap">{pending.body}</p>

          <span className="mt-0.5 flex items-center justify-end gap-1 text-2xs opacity-80">
            {failed ? (
              <>
                <TriangleAlert className="size-3" />
                Not sent
              </>
            ) : (
              <>
                <Loader2 className="size-3 animate-spin" />
                Sending
              </>
            )}
          </span>
        </div>

        {failed ? (
          <Button size="xs" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-3" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
