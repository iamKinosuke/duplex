"use client";

import { use } from "react";

import { ProfileView } from "@/features/profile/profile-view";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);

  return <ProfileView username={username} />;
}
