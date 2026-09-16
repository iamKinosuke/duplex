import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";

const COST = 12;

function prepare(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("base64");
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(prepare(password), COST);
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(prepare(password), stored);
  } catch {
    return false;
  }
}

let dummyHash: string | null = null;

export async function burnPasswordVerification(password: string): Promise<void> {
  dummyHash ??= await hashPassword(randomBytes(32).toString("hex"));
  await verifyPassword(password, dummyHash);
}
