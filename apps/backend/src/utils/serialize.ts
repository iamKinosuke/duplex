import type { Id } from "@duplex/shared";

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
