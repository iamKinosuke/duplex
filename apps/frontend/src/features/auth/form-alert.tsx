import { TriangleAlert } from "lucide-react";

export function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex animate-pop-in items-start gap-2.5 rounded-xl border-2 border-destructive/60 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
