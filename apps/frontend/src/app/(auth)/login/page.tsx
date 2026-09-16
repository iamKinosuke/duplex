import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in · duplex" };

export default function LoginPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <span className="inline-flex -rotate-2 items-center rounded-full border-2 border-ink bg-teal px-3 py-1 font-display text-xs font-semibold text-teal-foreground shadow-sticker-sm">
          Welcome back
        </span>
        <h1 className="font-display text-3xl font-semibold">
          Let&apos;s pick up where you left off
        </h1>
        <p className="text-muted-foreground">
          Sign in and your conversations come right back.
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
