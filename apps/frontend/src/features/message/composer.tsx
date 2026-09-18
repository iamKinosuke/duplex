"use client";

import { SendHorizontal } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { LIMITS } from "@duplex/shared";

import { Button } from "@/components/ui/button";
import { useSocketConnected } from "@/realtime/socket-provider";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (body: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const offline = !useSocketConnected();

  function submit(event: FormEvent) {
    event.preventDefault();

    const body = draft.trim();
    if (body === "") return;

    onSend(body);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="shrink-0 border-t-2 border-hairline bg-background/85 p-3 backdrop-blur"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, LIMITS.messageBody.max))}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={offline ? "Reconnecting…" : "Write a message"}
          className="max-h-40 min-h-field flex-1 resize-none rounded-xl border-2 border-border bg-card px-3.5 py-2.5 font-medium transition-[border-color,box-shadow] outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-60"
        />

        <Button
          type="submit"
          size="icon-lg"
          disabled={disabled === true || draft.trim() === ""}
          aria-label="Send message"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </form>
  );
}
