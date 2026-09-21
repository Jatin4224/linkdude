/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: EditIdeaDialog, EditIdeaDialogProps, edit idea,
 *   postIdeas.update
 *
 * WHAT:  A dialog to reword a saved idea.
 * WHY:   Owns its own update mutation, so the inbox only decides which idea is
 *        open. Remounted per idea (keyed by id), so the form always starts from
 *        that idea's current text.
 * WHERE: ideas-inbox.tsx.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";
import {
  createPostIdeaSchema,
  POST_IDEA_TEXT_MAX,
  type CreatePostIdeaValues,
} from "@/lib/types";
import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { TechButton } from "@/components/global/tech";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { PostIdeaRow } from "./idea-types";

export interface EditIdeaDialogProps {
  idea: PostIdeaRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditIdeaDialog({ idea, open, onOpenChange }: EditIdeaDialogProps) {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const form = useForm<CreatePostIdeaValues>({
    resolver: zodResolver(createPostIdeaSchema),
    defaultValues: { text: idea.text },
  });

  const update = trpc.postIdeas.update.useMutation({
    onSuccess: async () => {
      await utils.postIdeas.list.invalidate();
      toast.success("Idea updated.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function onSubmit(values: CreatePostIdeaValues) {
    if (!organizationId) return;
    update.mutate({
      organizationId,
      field: "text",
      id: idea.id,
      text: values.text,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tech-scope sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit idea</DialogTitle>
          <DialogDescription>
            It stays in your inbox until you turn it into a post.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      disabled={update.isPending}
                      className="resize-none"
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-2">
                    <FormMessage />
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {field.value.length} / {POST_IDEA_TEXT_MAX}
                    </span>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <TechButton type="submit" disabled={update.isPending}>
                {update.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : null}
                Save
              </TechButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
