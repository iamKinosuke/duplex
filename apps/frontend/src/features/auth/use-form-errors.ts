"use client";

import { useCallback, useMemo, useState } from "react";
import type { FieldValues, UseFormSetError, Path } from "react-hook-form";

import { ApiRequestError } from "@/lib/api";

export function useFormErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
) {
  const [message, setMessage] = useState<string | null>(null);

  const reset = useCallback(() => setMessage(null), []);

  const apply = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiRequestError)) {
        setMessage("Something went wrong. Please try again.");
        return;
      }

      let matched = false;

      for (const field of fields) {
        const detail = error.fieldError(field);
        if (detail !== undefined) {
          matched = true;
          setError(field, { type: "server", message: detail });
        }
      }

      setMessage(matched ? null : error.message);
    },
    [fields, setError],
  );

  return useMemo(() => ({ message, apply, reset }), [message, apply, reset]);
}
