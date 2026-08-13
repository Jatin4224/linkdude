/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: AiImageEdit, AiImageEditProps
 *
 * WHAT:  A dialog that rewrites the attached image from a typed instruction,
 *        shows the result beside the original, and only replaces the attachment
 *        once the user accepts it.
 * WHY:   Unlike the transform editor, this is NOT non-destructive — the model
 *        returns new bytes that become a new ImageKit asset. Two consequences
 *        shape this component: the result is staged and previewed rather than
 *        applied on arrival (a generation you did not ask to keep should not
 *        silently replace your photo), and Revert is offered whenever an
 *        original exists.
 *
 *        Generic like its image-upload and image-editor siblings: it takes an
 *        `onGenerate` callback rather than calling tRPC itself, so it knows
 *        nothing about LinkedIn, posts, or routers.
 * WHERE: Rendered by the post composer, which supplies the mutation.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SparklesIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  aiImageEditSchema,
  AI_IMAGE_PROMPT_MAX,
  type PostImageValues,
} from "@/lib/types";
import { buildTransformedUrl, LINKEDIN_IMAGE_TRANSFORM } from "@/lib/config";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* Only the prompt is typed here — the image half of the contract is supplied by
 * the caller, so the form resolves against exactly the field it owns. */
const promptSchema = aiImageEditSchema.pick({ prompt: true });
type PromptValues = { prompt: string };

export interface AiImageEditProps {
  value: PostImageValues;
  onChange: (value: PostImageValues) => void;
  /** Runs the edit. Returns the new reference, carrying `original` along. */
  onGenerate: (prompt: string) => Promise<PostImageValues>;
  disabled?: boolean;
  className?: string;
  label?: string;
}

/* The pixels as delivered, so before/after are compared on equal terms rather
 * than one showing the raw upload and the other the framed result. */
function previewUrl(image: PostImageValues): string {
  return buildTransformedUrl(
    image.url,
    image.transform ?? LINKEDIN_IMAGE_TRANSFORM,
  );
}

export function AiImageEdit({
  value,
  onChange,
  onGenerate,
  disabled = false,
  className,
  label = "Edit with AI",
}: AiImageEditProps) {
  const [open, setOpen] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  /* Staged, not applied: a result the user rejects must leave the attachment
   * exactly as it was. */
  const [result, setResult] = React.useState<PostImageValues | null>(null);

  const form = useForm<PromptValues>({
    resolver: zodResolver(promptSchema),
    defaultValues: { prompt: "" },
  });

  /* Cleared on CLOSE so reopening starts fresh rather than showing a stale
   * result against an image that may since have been replaced. Done in the
   * handler rather than an effect: closing is an event, and clearing state from
   * an effect body triggers the cascading render the lint rule guards against. */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      form.reset({ prompt: "" });
    }
  }

  async function handleGenerate({ prompt }: PromptValues) {
    setIsGenerating(true);
    try {
      setResult(await onGenerate(prompt));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not edit the image.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleAccept() {
    if (!result) return;
    onChange(result);
    setOpen(false);
  }

  function handleRevert() {
    if (!value.original) return;
    /* Drops `original` with it: once reverted there is nothing left to revert
     * TO, and keeping the key would offer the button forever. */
    onChange({ fileId: value.original.fileId, url: value.original.url });
    setOpen(false);
  }

  return (
    <>
      {/* The one filled button in the row, and the only orange one: AI editing
          is the differentiating action here, so it breaks away from the channel
          blue that the mechanical actions (replace / crop) share. */}
      <Button
        type="button"
        variant="ai"
        size="sm"
        disabled={disabled}
        className={cn("shadow-sm", className)}
        onClick={() => setOpen(true)}
      >
        <SparklesIcon className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit with AI</DialogTitle>
            <DialogDescription>
              Describe the change you want. This creates a new image — your
              original is kept so you can revert.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleGenerate)}
              className="flex flex-col gap-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <figure className="flex flex-col gap-2">
                  <figcaption className="text-xs text-muted-foreground">
                    Current
                  </figcaption>
                  <div className="flex items-center justify-center rounded-lg border bg-muted/40 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl(value)}
                      alt="Current attachment"
                      className="max-h-56 w-full object-contain"
                    />
                  </div>
                </figure>

                <figure className="flex flex-col gap-2">
                  <figcaption className="text-xs text-muted-foreground">
                    {result ? "Result" : "Result appears here"}
                  </figcaption>
                  <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-2">
                    {isGenerating ? (
                      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                    ) : result ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={previewUrl(result)}
                        alt="AI edited result"
                        className="max-h-56 w-full object-contain"
                      />
                    ) : (
                      <p className="px-3 text-center text-xs text-muted-foreground">
                        Nothing generated yet
                      </p>
                    )}
                  </div>
                </figure>
              </div>

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What should change?</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        maxLength={AI_IMAGE_PROMPT_MAX}
                        placeholder="Remove the background, make the lighting warmer, add a subtle gradient…"
                        disabled={isGenerating}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormDescription>
                      Describe the change, not the whole picture — the model
                      edits what is already there.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                {value.original ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRevert}
                    disabled={isGenerating}
                  >
                    <Undo2Icon className="size-4" />
                    Revert to original
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>
                {/* Submit stays available after a result so "not quite" is one
                    reworded prompt away rather than a close-and-reopen. */}
                <Button type="submit" variant="outline" disabled={isGenerating}>
                  {isGenerating ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-4" />
                  )}
                  {result ? "Try again" : "Generate"}
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleAccept}
                  disabled={!result || isGenerating}
                >
                  Use this image
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
