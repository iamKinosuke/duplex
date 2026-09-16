import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "group/mark grid size-10 shrink-0 place-items-center rounded-xl border-2 border-ink bg-primary text-primary-foreground shadow-sticker",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5.5" fill="none">
        <path
          d="M3.6 9.2A4.2 4.2 0 0 1 7.8 5h5.6a4.2 4.2 0 0 1 0 8.4H8.2l-4.6 3.2z"
          fill="currentColor"
        />
        <circle cx="8.4" cy="9.2" r="1.05" className="fill-primary" />
        <circle cx="12.4" cy="9.2" r="1.05" className="fill-primary" />
        <path
          d="M20.4 14.1a3.8 3.8 0 0 0-3.8-3.8h-.5v.7a5.9 5.9 0 0 1-5.9 5.9h-1a3.8 3.8 0 0 0 3.5 2.3h3.9l3.8 2.6z"
          fill="currentColor"
          opacity="0.45"
        />
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("group flex items-center gap-2.5", className)}>
      <BrandMark className="transition-transform duration-(--duration-normal) ease-(--ease-spring) group-hover:-rotate-6 group-hover:scale-105" />
      <span className="font-display text-xl font-semibold tracking-tight">
        duplex
      </span>
    </span>
  );
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-blink rounded-full bg-current"
          style={{ animationDelay: `${index * 180}ms` }}
        />
      ))}
    </span>
  );
}
