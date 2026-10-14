import { createHash } from "node:crypto";
import type { LinkPreview } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import { logger } from "../lib/logger.js";
import type { RedisClients } from "../lib/redis.js";
import { checkUrl } from "../utils/safe-url.js";

const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5_000;
const HIT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MISS_TTL_SECONDS = 24 * 60 * 60;

export interface LinkPreviewService {
  fetch(raw: string): Promise<LinkPreview | null>;
}

export interface LinkPreviewServiceDeps {
  redis?: RedisClients | undefined;
}

function keyFor(url: string): string {
  return `link:${createHash("sha1").update(url).digest("hex")}`;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (whole, body: string) => {
    const lower = body.toLowerCase();

    if (lower.startsWith("#")) {
      const digits = lower.startsWith("#x") ? lower.slice(2) : lower.slice(1);
      const code = Number.parseInt(digits, lower.startsWith("#x") ? 16 : 10);

      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }

    return ENTITIES[lower] ?? whole;
  });
}

function metaOf(html: string, names: string[]): string | null {
  for (const name of names) {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`,
      "iu",
    );
    const tag = pattern.exec(html)?.[0];

    if (tag === undefined) continue;

    const content = /content=["']([^"']*)["']/iu.exec(tag)?.[1];

    if (content !== undefined && content.trim() !== "") {
      return decodeEntities(content.trim());
    }
  }

  return null;
}

function titleOf(html: string): string | null {
  const direct = metaOf(html, ["og:title", "twitter:title"]);
  if (direct !== null) return direct;

  const tag = /<title[^>]*>([\s\S]{0,300}?)<\/title>/iu.exec(html)?.[1];
  const text = tag?.replace(/\s+/gu, " ").trim();

  return text === undefined || text === "" ? null : decodeEntities(text);
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (reader === undefined) return "";

  const decoder = new TextDecoder();
  let html = "";
  let read = 0;

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;

    read += chunk.value.length;
    html += decoder.decode(chunk.value, { stream: true });

    if (read >= MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }

  return html;
}

export function createLinkPreviewService(
  deps: LinkPreviewServiceDeps,
): LinkPreviewService {
  async function cached(key: string): Promise<LinkPreview | null | undefined> {
    if (deps.redis === undefined || !deps.redis.isReady()) return undefined;

    try {
      const raw = await deps.redis.commands.get(key);
      if (raw === null) return undefined;

      return raw === "null" ? null : (JSON.parse(raw) as LinkPreview);
    } catch (error) {
      logger.warn("link cache unavailable", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async function remember(
    key: string,
    preview: LinkPreview | null,
  ): Promise<void> {
    if (deps.redis === undefined || !deps.redis.isReady()) return;

    try {
      await deps.redis.commands.set(
        key,
        preview === null ? "null" : JSON.stringify(preview),
        "EX",
        preview === null ? MISS_TTL_SECONDS : HIT_TTL_SECONDS,
      );
    } catch (error) {
      logger.warn("link cache write failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function crawl(raw: string): Promise<LinkPreview | null> {
    let target = raw;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const check = await checkUrl(target);

      if (!check.ok) {
        throw AppError.badRequest("That link cannot be previewed.");
      }

      const response = await fetch(check.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: "text/html",
          "User-Agent": "duplex-link-preview/1.0",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        if (next === null) return null;

        target = new URL(next, check.url).toString();
        continue;
      }

      if (!response.ok) return null;

      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("text/html")) return null;

      const html = await readCapped(response);

      const preview: LinkPreview = {
        url: check.url.toString(),
        title: titleOf(html),
        description: metaOf(html, ["og:description", "description"]),
        image: metaOf(html, ["og:image", "twitter:image"]),
        siteName: metaOf(html, ["og:site_name"]),
      };

      return preview.title === null && preview.image === null ? null : preview;
    }

    return null;
  }

  return {
    async fetch(raw) {
      const key = keyFor(raw);
      const hit = await cached(key);

      if (hit !== undefined) return hit;

      try {
        const preview = await crawl(raw);
        await remember(key, preview);
        return preview;
      } catch (error) {
        if (error instanceof AppError) throw error;

        logger.debug("link preview failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        await remember(key, null);
        return null;
      }
    },
  };
}
