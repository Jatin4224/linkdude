/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: IdeaQuickAdd, IdeaQuickAddProps, save an idea,
 *   quick capture, postIdeas.create
 *
 * WHAT:  A one-line box that saves a post idea in a couple of seconds.
 * WHY:   Global because ideas arrive wherever the member happens to be: the
 *        dashboard and the Ideas page both render it, and they must behave the
 *        same. It owns its mutation and hides itself without the create
 *        permission, so a screen only has to place it.
 * WHERE: The Ideas page and the dashboard's idea card.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { permissions } from "@/lib/better-auth/permissions";
import { getErrorMessage } from "@/lib/errors";
import {
  createPostIdeaSchema,
  DEFAULT_POST_IDEA,
  POST_IDEA_TEXT_MAX,
  type CreatePostIdeaValues,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import { FeatureGate } from "@/components/feature-gate";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

export interface IdeaQuickAddProps {
  placeholder?: string | undefined;
  className?: string | undefined;
}

export function IdeaQuickAdd({
  placeholder = "An idea for a post...",
  className,
}: IdeaQuickAddProps) {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();
  const utils = trpc.useUtils();

  const form = useForm<CreatePostIdeaValues>({
    resolver: zodResolver(createPostIdeaSchema),
    defaultValues: DEFAULT_POST_IDEA,
  });

  const create = trpc.postIdeas.create.useMutation({
    onSuccess: async () => {
      form.reset(DEFAULT_POST_IDEA);
      toast.success("Idea saved.");
      /* Usage too: each saved idea holds a slot on the plan. */
      await Promise.all([
        utils.postIdeas.list.invalidate(),
        utils.usage.invalidate(),
      ]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!organizationId || !hasPermission(permissions.POST_IDEAS_CREATE)) {
    return null;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          create.mutate({ ...values, organizationId }),
        )}
        className={cn("flex items-start gap-2", className)}
      >
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  {...field}
                  placeholder={placeholder}
                  maxLength={POST_IDEA_TEXT_MAX}
                  disabled={create.isPending}
                  aria-label="New idea"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FeatureGate resource="postIdeas">
          <Button type="submit" variant="brand" disabled={create.isPending}>
            {create.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Save idea
          </Button>
        </FeatureGate>
      </form>
    </Form>
  );
}
