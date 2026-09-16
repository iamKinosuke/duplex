import type { PrismaClient } from "../generated/prisma/client.js";

export interface RefreshTokenRecord {
  id: bigint;
  userId: bigint;
  tokenHash: string;
  familyId: string;
  userAgent: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateRefreshTokenData {
  userId: bigint;
  tokenHash: string;
  familyId: string;
  userAgent: string | null;
  expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeIfActive(id: bigint, at: Date): Promise<boolean>;
  revokeFamily(familyId: string, at: Date): Promise<number>;
  deleteFamily(familyId: string): Promise<number>;
  countActiveInFamily(familyId: string): Promise<number>;
  deleteExpired(before: Date): Promise<number>;
}

export function createRefreshTokenRepository(
  client: PrismaClient,
): RefreshTokenRepository {
  return {
    async create(data) {
      return await client.refreshToken.create({ data });
    },

    async findByHash(tokenHash) {
      return await client.refreshToken.findUnique({ where: { tokenHash } });
    },

    async revokeIfActive(id, at) {
      const result = await client.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: at },
      });
      return result.count === 1;
    },

    async revokeFamily(familyId, at) {
      const result = await client.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: at },
      });
      return result.count;
    },

    async deleteFamily(familyId) {
      const result = await client.refreshToken.deleteMany({
        where: { familyId },
      });
      return result.count;
    },

    async countActiveInFamily(familyId) {
      return await client.refreshToken.count({
        where: { familyId, revokedAt: null },
      });
    },

    async deleteExpired(before) {
      const result = await client.refreshToken.deleteMany({
        where: { expiresAt: { lt: before } },
      });
      return result.count;
    },
  };
}
