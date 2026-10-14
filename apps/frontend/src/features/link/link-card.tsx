"use client";

import { useLinkPreview } from "./queries";

export function LinkCard({ url }: { url: string }) {
  const preview = useLinkPreview(url);

  if (preview.data == null) return null;

  const { title, description, image, siteName } = preview.data;

  return (
    <a
      href={preview.data.url}
      target="_blank"
      rel="noreferrer noopener"
      className="mt-1.5 block overflow-hidden rounded-xl border-2 border-ink/20 bg-card/60 transition-colors duration-(--duration-fast) hover:border-ink/50"
    >
      {image !== null ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          className="h-32 w-full object-cover"
        />
      ) : null}

      <span className="block space-y-0.5 px-2.5 py-2">
        {siteName !== null ? (
          <span className="block truncate text-2xs text-muted-foreground uppercase">
            {siteName}
          </span>
        ) : null}
        {title !== null ? (
          <span className="line-clamp-2 block font-display text-xs font-semibold">
            {title}
          </span>
        ) : null}
        {description !== null ? (
          <span className="line-clamp-2 block text-2xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </a>
  );
}
