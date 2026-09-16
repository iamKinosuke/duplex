"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LIMITS, zRegisterBody, type RegisterBody } from "@duplex/shared";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormAlert } from "./form-alert";
import { useFormErrors } from "./use-form-errors";
import { useRegister } from "./session";

const FIELDS = ["email", "username", "displayName", "password"] as const;

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();

  const form = useForm<RegisterBody>({
    resolver: zodResolver(zRegisterBody),
    defaultValues: { email: "", username: "", displayName: "", password: "" },
  });

  const errors = useFormErrors<RegisterBody>(form.setError, FIELDS);

  async function onSubmit(values: RegisterBody) {
    errors.reset();

    try {
      await register.mutateAsync(values);
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
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-display font-semibold">Display name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="name"
                  placeholder="Mai Nguyen"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
                />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-display font-semibold">Username</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="username"
                  placeholder="mai"
                                    onChange={(event) =>
                    field.onChange(event.target.value.toLowerCase())
                  }
                />
              </FormControl>
              <FormDescription>
                Lowercase letters, numbers and underscore, {LIMITS.username.min}–
                {LIMITS.username.max} characters.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
                />

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
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </FormControl>
              <FormDescription>
                At least {LIMITS.password.min} characters.
              </FormDescription>
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
          Create account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-display font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-[3px]"
          >
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
