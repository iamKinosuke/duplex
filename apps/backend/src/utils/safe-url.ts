import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type UnsafeReason =
  | "scheme"
  | "shape"
  | "unresolvable"
  | "private-address";

export type UrlCheck =
  | { ok: true; url: URL; address: string }
  | { ok: false; reason: UnsafeReason };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function privateV4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [a, b] = parts;

  if (parts.length !== 4 || a === undefined || b === undefined) return true;
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;

  return false;
}

function privateV6(address: string): boolean {
  const plain = address.toLowerCase().split("%")[0] ?? "";

  if (plain === "::" || plain === "::1") return true;
  if (plain.startsWith("fe8") || plain.startsWith("fe9")) return true;
  if (plain.startsWith("fea") || plain.startsWith("feb")) return true;
  if (plain.startsWith("fc") || plain.startsWith("fd")) return true;
  if (plain.startsWith("2001:db8")) return true;

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(plain);
  if (mapped?.[1] !== undefined) return privateV4(mapped[1]);

  return false;
}

export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);

  if (kind === 4) return privateV4(address);
  if (kind === 6) return privateV6(address);

  return true;
}

export async function checkUrl(raw: string): Promise<UrlCheck> {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "shape" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "scheme" };
  }

  const host = url.hostname.replace(/^\[|\]$/gu, "");

  if (isIP(host) !== 0) {
    return isPrivateAddress(host)
      ? { ok: false, reason: "private-address" }
      : { ok: true, url, address: host };
  }

  try {
    const resolved = await lookup(host, { all: true });

    if (resolved.length === 0) {
      return { ok: false, reason: "unresolvable" };
    }

    if (resolved.some((entry) => isPrivateAddress(entry.address))) {
      return { ok: false, reason: "private-address" };
    }

    return { ok: true, url, address: resolved[0]?.address ?? host };
  } catch {
    return { ok: false, reason: "unresolvable" };
  }
}
