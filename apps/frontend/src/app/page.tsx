"use client";

import { RequireSession } from "@/features/auth/auth-gate";
import { HomeView } from "@/features/shell/home-view";
import { useSession } from "@/features/auth/session";

export default function HomePage() {
  return (
    <RequireSession>
      <SignedIn />
    </RequireSession>
  );
}

function SignedIn() {
  const session = useSession();

  return session.data == null ? null : <HomeView me={session.data} />;
}
