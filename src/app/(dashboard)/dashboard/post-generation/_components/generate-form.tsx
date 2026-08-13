/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: GenerateForm, GenerateFormProps, TONE_LABELS,
 *   LENGTH_LABELS
 *
 * WHAT:  The composer's left pane — Topic / Blog tabs plus tone and length
 *        selects, submitting a validated generation request.
 * WHY:   Topic and Blog are separate branches of `generatePostSchema`, so each
 *        tab gets its own RHF instance typed to its branch via `Extract`. That
 *        keeps the union's guarantee (a blog request cannot carry a topic) at
 *        the type level instead of relying on a runtime check, and avoids
 *        redeclaring any shape — both forms resolve against the shared schema.
 *        Tone and length are lifted to the parent so switching tabs doesn't
 *        silently reset the user's choices.
 * WHERE: Rendered by post-composer.tsx.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import {
  generatePostSchema,
  POST_TONES,
  POST_LENGTHS,
  type GeneratePostValues,
  type PostTone,
  type PostLength,
} from "@/lib/types";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type TopicValues = Extract<GeneratePostValues, { source: "topic" }>;
type BlogValues = Extract<GeneratePostValues, { source: "blog" }>;

/* Human labels for the enum values. Derived from the schema's const tuples, so
 * adding a tone in lib/types surfaces here as a type error rather than a
 * silently missing option. */
const TONE_LABELS: Record<PostTone, string> = {
  professional: "Professional",
  conversational: "Conversational",
  storytelling: "Storytelling",
  contrarian: "Contrarian",
  educational: "Educational",
};

const LENGTH_LABELS: Record<PostLength, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export interface GenerateFormProps {
  tone: PostTone;
  length: PostLength;
  onToneChange: (tone: PostTone) => void;
  onLengthChange: (length: PostLength) => void;
  onGenerate: (values: GeneratePostValues) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function GenerateForm({
  tone,
  length,
  onToneChange,
  onLengthChange,
  onGenerate,
  isGenerating,
  disabled = false,
}: GenerateFormProps) {
  const topicForm = useForm<TopicValues>({
    resolver: zodResolver(generatePostSchema.options[0]),
    defaultValues: { source: "topic", topic: "", tone, length },
  });

  const blogForm = useForm<BlogValues>({
    resolver: zodResolver(generatePostSchema.options[1]),
    defaultValues: { source: "blog", blogUrl: "", tone, length },
  });

  /* Tone/length live in the parent so they survive a tab switch; mirror them
   * into whichever form is about to be submitted. */
  React.useEffect(() => {
    topicForm.setValue("tone", tone);
    blogForm.setValue("tone", tone);
    topicForm.setValue("length", length);
    blogForm.setValue("length", length);
  }, [tone, length, topicForm, blogForm]);

  const busy = isGenerating || disabled;

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="topic">
        <TabsList className="grid w-full grid-cols-2">
          {/* Active tab carries the accent so the source you're generating from
              is legible at a glance against the muted track. */}
          {/* Both variants: the base trigger ships a `dark:data-active:` rule
              that sorts after an unprefixed one and would otherwise win. The
              icon inherits currentColor, so it needs no separate rule. */}
          <TabsTrigger
            value="topic"
            className="data-active:text-brand-soft-foreground dark:data-active:text-brand-soft-foreground"
          >
            <SparklesIcon className="size-4" />
            Topic
          </TabsTrigger>
          <TabsTrigger
            value="blog"
            className="data-active:text-brand-soft-foreground dark:data-active:text-brand-soft-foreground"
          >
            Blog URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topic" className="mt-4">
          <Form {...topicForm}>
            <form
              onSubmit={topicForm.handleSubmit(onGenerate)}
              className="flex flex-col gap-4"
              id="generate-topic-form"
            >
              <FormField
                control={topicForm.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What&rsquo;s the post about?</FormLabel>
                    <FormControl>
                      {/* Six rows, not ten: the generated post appears in the
                          preview beside this, so a taller box here only pushed
                          the tone/length controls and Generate below the fold. */}
                      <Textarea
                        {...field}
                        rows={6}
                        placeholder="A lesson you learned, an opinion you can defend, a mistake worth naming…"
                        disabled={busy}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormDescription>
                      A sentence is plenty. Specifics beat topics.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="brand"
                disabled={busy}
                className="w-full"
              >
                {isGenerating ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SparklesIcon className="size-4" />
                )}
                Generate Post
              </Button>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="blog" className="mt-4">
          <Form {...blogForm}>
            <form
              onSubmit={blogForm.handleSubmit(onGenerate)}
              className="flex flex-col gap-4"
              id="generate-blog-form"
            >
              <FormField
                control={blogForm.control}
                name="blogUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blog URL to repurpose</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="url"
                        placeholder="https://example.com/article"
                        disabled={busy}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="brand"
                disabled={busy}
                className="w-full"
              >
                {isGenerating ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SparklesIcon className="size-4" />
                )}
                Generate Post
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>

      {/* Shared across both tabs, so they sit outside the Tabs content. Side by
          side rather than stacked: two short selects in one row keeps the whole
          control panel above the fold instead of pushing Generate off it. */}
      <div className="grid grid-cols-2 gap-3 border-t pt-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tone-select">Tone</Label>
          <Select
            value={tone}
            onValueChange={(value) => onToneChange(value as PostTone)}
          >
            <SelectTrigger id="tone-select" disabled={busy} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POST_TONES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TONE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="length-select">Length</Label>
          <Select
            value={length}
            onValueChange={(value) => onLengthChange(value as PostLength)}
          >
            <SelectTrigger
              id="length-select"
              disabled={busy}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POST_LENGTHS.map((value) => (
                <SelectItem key={value} value={value}>
                  {LENGTH_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
