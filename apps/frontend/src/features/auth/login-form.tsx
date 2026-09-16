"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { zLoginBody, type LoginBody } from "@duplex/shared";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormAlert } from "./form-alert";
import { useFormErrors } from "./use-form-errors";
import { useLogin } from "./session";

const FIELDS = ["email", "password"] as const;

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();

  const form = useForm<LoginBody>({
    resolver: zodResolver(zLoginBody),
    defaultValues: { email: "", password: "" },
  });

  const errors = useFormErrors<LoginBody>(form.setError, FIELDS);

  async function onSubmit(values: LoginBody) {
    errors.reset();

    try {
      await login.mutateAsync(values);
      router.replace("/");
    } catch (error) {
      errors.apply(error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {errors.message !== null ? <FormAlert message={errors.message} /> : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-display font-semibold">Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
                />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-display font-semibold">Password</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
                />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Sign in
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/register"
            className="font-display font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-[3px]"
          >
            Create an account
          </Link>
        </p>
      </form>
    </Form>
  );
}
