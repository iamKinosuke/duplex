"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "./session";

export function RequireGuest({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.data != null) router.replace("/");
  }, [router, session.data]);

  if (session.isPending || session.data != null) {
    return <AuthFallback />;
  }

  return <>{children}</>;
}

export function RequireSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session.isPending && session.data == null) router.replace("/login");
  }, [router, session.data, session.isPending]);

  if (session.isPending || session.data == null) {
    return <ShellFallback />;
  }

  return <>{children}</>;
}

function AuthFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-40 rounded-full" />
      <Skeleton className="h-field w-full rounded-xl" />
      <Skeleton className="h-field w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="grid h-dvh grid-cols-1 md:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
      <div className="hidden flex-col gap-3 border-r-2 border-hairline bg-surface p-4 md:flex">
        <Skeleton className="h-10 w-full rounded-xl" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <div className="dotted-grid grid place-items-center">
        <Skeleton className="size-14 rounded-2xl" />
      </div>
    </div>
  );
}
