export function openConversationId(pathname: string): string | null {
  const match = /^\/c\/(\d+)/u.exec(pathname);
  return match?.[1] ?? null;
}
