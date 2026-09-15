import { z } from "zod";

export const zId = z
  .string()
  .regex(/^\d+$/, "must be a numeric id")
  .brand<"Id">();

export type Id = z.infer<typeof zId>;

export const zCursor = zId.nullish();

export function toId(value: bigint | number | string): Id {
  return String(value) as Id;
}
