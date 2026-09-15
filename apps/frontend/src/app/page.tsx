import { LIMITS, TIMINGS } from "@duplex/shared";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Phase 1</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Workspace is wired up
        </h1>
        <p className="text-muted-foreground">
          Next.js 16 · Express 5 · Prisma 7 / MySQL 8 · Socket.IO · Redis
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm">
        <p className="mb-3 font-medium">Live from <code>@duplex/shared</code></p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground">
          <dt>Max message length</dt>
          <dd className="text-foreground">{LIMITS.messageBody.max}</dd>
          <dt>Page size</dt>
          <dd className="text-foreground">{LIMITS.page.default}</dd>
          <dt>Presence TTL</dt>
          <dd className="text-foreground">{TIMINGS.presenceTtlSeconds}s</dd>
          <dt>Typing TTL</dt>
          <dd className="text-foreground">{TIMINGS.typingTtlSeconds}s</dd>
        </dl>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-bubble-in px-4 py-2 text-bubble-in-foreground">
          Incoming bubble
        </div>
        <div className="flex-1 rounded-lg bg-bubble-out px-4 py-2 text-bubble-out-foreground">
          Outgoing bubble
        </div>
      </div>
    </main>
  );
}
