"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface AppShellProps {
  sidebar: ReactNode;
  detail: ReactNode;
  panel?: ReactNode;
  detailOpen?: boolean;
}

export function AppShell({
  sidebar,
  detail,
  panel,
  detailOpen = false,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "grid h-dvh w-full overflow-hidden bg-background",
        "grid-cols-1",
        "md:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]",
        panel !== undefined &&
          "xl:grid-cols-[var(--spacing-sidebar-wide)_minmax(0,1fr)_var(--spacing-panel)]",
      )}
    >
      <aside
        data-open={!detailOpen}
        className={cn(
          "min-h-0 flex-col border-r-2 border-hairline bg-surface",
          "hidden data-[open=true]:flex",
          "md:flex",
        )}
      >
        {sidebar}
      </aside>

      <main
        data-open={detailOpen}
        className={cn(
          "dotted-grid min-h-0 min-w-0 flex-col",
          "hidden data-[open=true]:flex",
          "md:flex",
        )}
      >
        {detail}
      </main>

      {panel !== undefined ? (
        <aside className="hidden min-h-0 flex-col border-l-2 border-hairline bg-surface xl:flex">
          {panel}
        </aside>
      ) : null}
    </div>
  );
}
