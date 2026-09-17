import { Prisma, type PrismaClient } from "../generated/prisma/client.js";

export interface UserRecord {
  id: bigint;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  passwordHash: string;
  lastSeenAt: Date | null;
  createdAt: Date;
}

export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  lastSeenAt: true,
} satisfies Prisma.UserSelect;

export type PublicUserRow = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export type DuplicateField = "email" | "username";

export class DuplicateUserError extends Error {
  readonly field: DuplicateField;

  constructor(field: DuplicateField) {
    super(`${field} already taken`);
    this.name = "DuplicateUserError";
    this.field = field;
  }
}

export interface CreateUserData {
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
}

export interface UpdateProfileData {
  displayName?: string | undefined;
  bio?: string | null | undefined;
  avatarUrl?: string | null | undefined;
}

export interface UserRepository {
  create(data: CreateUserData): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: bigint): Promise<UserRecord | null>;
  existsById(id: bigint): Promise<boolean>;
  updateProfile(id: bigint, data: UpdateProfileData): Promise<UserRecord>;
  search(options: SearchUsersOptions): Promise<PublicUserRow[]>;
}

export interface SearchUsersOptions {
  query: string;
  limit: number;
  excludeUserId: bigint;
}

function duplicateFieldOf(error: unknown): DuplicateField | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }

  const target = error.meta?.["target"];
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "");

  if (text.includes("username")) return "username";
  return "email";
}

export function createUserRepository(client: PrismaClient): UserRepository {
  return {
    async create(data) {
      try {
        return await client.user.create({ data });
      } catch (error) {
        const field = duplicateFieldOf(error);
        if (field !== null) throw new DuplicateUserError(field);
        throw error;
      }
    },

    async findByEmail(email) {
      return await client.user.findUnique({ where: { email } });
    },

    async findById(id) {
      return await client.user.findUnique({ where: { id } });
    },

    async existsById(id) {
      const row = await client.user.findUnique({
        where: { id },
        select: { id: true },
      });
      return row !== null;
    },

    async updateProfile(id, data) {
      const patch: Prisma.UserUpdateInput = {};

      if (data.displayName !== undefined) patch.displayName = data.displayName;
      if (data.bio !== undefined) patch.bio = data.bio;
      if (data.avatarUrl !== undefined) patch.avatarUrl = data.avatarUrl;

      return await client.user.update({ where: { id }, data: patch });
    },

    async search({ query, limit, excludeUserId }) {
      return await client.user.findMany({
        where: {
          id: { not: excludeUserId },
          OR: [{ username: { contains: query } }, { displayName: { contains: query } }],
        },
        select: publicUserSelect,
        orderBy: [{ username: "asc" }],
        take: limit,
      });
    },
  };
}
