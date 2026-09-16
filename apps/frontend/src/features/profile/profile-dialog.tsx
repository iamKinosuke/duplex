"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  LIMITS,
  zUpdateProfileBody,
  type Me,
  type UpdateProfileBody,
} from "@duplex/shared";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { UserAvatar } from "@/components/user-avatar";
import { FormAlert } from "@/features/auth/form-alert";
import { useUpdateProfile } from "@/features/auth/session";
import { useFormErrors } from "@/features/auth/use-form-errors";

const FIELDS = ["displayName", "bio", "avatarUrl"] as const;

export function ProfileDialog({
  me,
  children,
}: {
  me: Me;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateProfile();

  const form = useForm<UpdateProfileBody>({
    resolver: zodResolver(zUpdateProfileBody),
    defaultValues: {
      displayName: me.displayName,
      bio: me.bio ?? "",
      avatarUrl: me.avatarUrl ?? "",
    },
  });

  const errors = useFormErrors<UpdateProfileBody>(form.setError, FIELDS);

  function handleOpenChange(next: boolean) {
    if (next) {
      form.reset({
        displayName: me.displayName,
        bio: me.bio ?? "",
        avatarUrl: me.avatarUrl ?? "",
      });
      errors.reset();
    }
    setOpen(next);
  }

  async function onSubmit(values: UpdateProfileBody) {
    errors.reset();

    try {
      await update.mutateAsync({
        displayName: values.displayName,
        bio: values.bio === "" ? null : values.bio,
        avatarUrl: values.avatarUrl === "" ? null : values.avatarUrl,
      });
      setOpen(false);
    } catch (error) {
      errors.apply(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-2xl border-2 border-ink shadow-sticker-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Edit profile</DialogTitle>
          <DialogDescription>
            This is what other people see next to your messages.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border-2 border-hairline bg-surface p-3">
          <UserAvatar user={me} className="size-12" />
          <div className="min-w-0">
            <p className="truncate font-display font-semibold">{me.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{me.username}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {errors.message !== null ? (
              <FormAlert message={errors.message} />
            ) : null}

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-display font-semibold">Display name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-display font-semibold">Bio</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Building things."
                    />
                  </FormControl>
                  <FormDescription>
                    Up to {LIMITS.bio.max} characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-display font-semibold">Avatar URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="https://..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
