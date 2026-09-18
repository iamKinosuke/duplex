"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { RequireSession } from "@/features/auth/auth-gate";
import { useSession } from "@/features/auth/session";
import { AppShell } from "@/features/shell/app-shell";
import { InfoPanel } from "@/features/shell/info-panel";
import { Sidebar } from "@/features/shell/sidebar";
import { SocketProvider } from "@/realtime/socket-provider";
import { useRealtimeSync } from "@/realtime/use-realtime-sync";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <SocketProvider>
        <Shell>{children}</Shell>
      </SocketProvider>
    </RequireSession>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();

  useRealtimeSync();

  if (session.data == null) return null;

  return (
    <AppShell
      detailOpen={pathname !== "/"}
      sidebar={<Sidebar me={session.data} />}
      detail={children}
      panel={<InfoPanel me={session.data} />}
    />
  );
}
