import type { Me, UpdateProfileBody } from "@duplex/shared";

import { AppError } from "../errors/AppError.js";
import type { UserRepository } from "../repositories/user.repository.js";
import { toMe } from "../utils/serialize.js";

export interface UserServiceDeps {
  users: UserRepository;
}

export interface UserService {
  me(userId: bigint): Promise<Me>;
  updateProfile(userId: bigint, body: UpdateProfileBody): Promise<Me>;
}

export function createUserService(deps: UserServiceDeps): UserService {
  return {
    async me(userId) {
      const user = await deps.users.findById(userId);

      if (user === null) {
        throw AppError.unauthenticated("That session is no longer valid.");
      }

      return toMe(user);
    },

    async updateProfile(userId, body) {
      const user = await deps.users.findById(userId);

      if (user === null) {
        throw AppError.unauthenticated("That session is no longer valid.");
      }

      const updated = await deps.users.updateProfile(userId, body);
      return toMe(updated);
    },
  };
}
