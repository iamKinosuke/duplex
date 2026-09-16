"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  zAuthResponse,
  zMe,
  type LoginBody,
  type Me,
  type RegisterBody,
  type UpdateProfileBody,
} from "@duplex/shared";

import { apiFetch, ApiRequestError, setAccessToken } from "@/lib/api";

export const sessionKey = ["auth", "session"] as const;

export function useSession(): UseQueryResult<Me | null> {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await apiFetch({ path: "/api/auth/me", schema: zMe });
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin(): UseMutationResult<void, Error, LoginBody> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (body: LoginBody) => {
      const session = await apiFetch({
        path: "/api/auth/login",
        method: "POST",
        body,
        schema: zAuthResponse,
        auth: false,
      });

      setAccessToken(session.accessToken);
      await client.invalidateQueries({ queryKey: sessionKey });
    },
  });
}

export function useRegister(): UseMutationResult<void, Error, RegisterBody> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (body: RegisterBody) => {
      const session = await apiFetch({
        path: "/api/auth/register",
        method: "POST",
        body,
        schema: zAuthResponse,
        auth: false,
      });

      setAccessToken(session.accessToken);
      await client.invalidateQueries({ queryKey: sessionKey });
    },
  });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiFetch({
        path: "/api/auth/logout",
        method: "POST",
        auth: false,
      });

      setAccessToken(null);
      client.setQueryData(sessionKey, null);
      client.removeQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateProfile(): UseMutationResult<
  Me,
  Error,
  UpdateProfileBody
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProfileBody) =>
      apiFetch({
        path: "/api/users/me",
        method: "PATCH",
        body,
        schema: zMe,
      }),
    onSuccess: (me) => {
      client.setQueryData(sessionKey, me);
    },
  });
}
