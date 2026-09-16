import type { Id, Me, User } from "@duplex/shared";

export function id(value: bigint): Id {
  return value.toString() as Id;
}

export function optionalId(value: bigint | null): Id | null {
  return value === null ? null : id(value);
}

export function toBigInt(value: string): bigint {
  return BigInt(value);
}

export function iso(value: Date): string {
  return value.toISOString();
}

export function optionalIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export interface PublicUserRow {
  id: bigint;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  lastSeenAt: Date | null;
}

export function toUser(row: PublicUserRow): User {
  return {
    id: id(row.id),
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    lastSeenAt: optionalIso(row.lastSeenAt),
  };
}

export function toMe(row: PublicUserRow & { email: string }): Me {
  return { ...toUser(row), email: row.email };
}
