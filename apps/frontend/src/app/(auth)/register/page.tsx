import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = { title: "Create account · duplex" };

export default function RegisterPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <span className="inline-flex rotate-2 items-center rounded-full border-2 border-ink bg-lemon px-3 py-1 font-display text-xs font-semibold text-ink shadow-sticker-sm">
          New here
        </span>
        <h1 className="font-display text-3xl font-semibold">
          Grab yourself a username
        </h1>
        <p className="text-muted-foreground">
          It is how people will find you once the rooms open up.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
