/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: CarouselForm, CarouselFormProps, CAROUSEL_TONE_LABELS,
 *   CAROUSEL_TEMPLATE_LABELS
 *
 * WHAT:  The generate form — topic, deck length, tone, template and page shape.
 * WHY:   Resolves against generateCarouselSchema, the same schema the router
 *        validates with, so the browser and the server cannot disagree about what
 *        a valid brief is. Every bound (topic length, slide count) comes from the
 *        exported constants rather than being restated here, so the counter under
 *        the textarea and the error that blocks submit always quote one number.
 * WHERE: Rendered inside the new-carousel dialog on the carousel workspace.
 */

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import {
  generateCarouselSchema,
  CAROUSEL_MIN_SLIDES,
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_DEFAULT_SLIDES,
  CAROUSEL_TOPIC_MAX,
  CAROUSEL_TEMPLATES,
  CAROUSEL_PAGE_PRESETS,
  POST_TONES,
  type GenerateCarouselValues,
  type GenerateCarouselInput,
  type CarouselTemplate,
  type CarouselPagePreset,
  type PostTone,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* Derived from the schema's const tuples, so adding a tone or template in
 * lib/types surfaces here as a type error rather than a silently missing option. */
const CAROUSEL_TONE_LABELS: Record<PostTone, string> = {
  professional: "Professional",
  conversational: "Conversational",
  storytelling: "Storytelling",
  contrarian: "Contrarian",
  educational: "Educational",
};

const CAROUSEL_TEMPLATE_LABELS: Record<CarouselTemplate, string> = {
  minimal: "Minimal — dark, quiet",
  bold: "Bold — brand blue field",
  editorial: "Editorial — light, document-like",
};

/* Slide counts are offered as a list rather than a number input: the useful range
 * is small and bounded, and a spinner invites typing 40 only to be rejected. */
const SLIDE_COUNTS = Array.from(
  { length: CAROUSEL_MAX_SLIDES - CAROUSEL_MIN_SLIDES + 1 },
  (_, index) => CAROUSEL_MIN_SLIDES + index,
);

export interface CarouselFormProps {
  onGenerate: (values: GenerateCarouselValues) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function CarouselForm({
  onGenerate,
  isGenerating,
  disabled = false,
}: CarouselFormProps) {
  /* Three type arguments, not one: the schema's `.default()` fields are optional
   * on the way in and guaranteed on the way out, so the field state is typed on
   * the INPUT half and the submit handler on the OUTPUT half. Declaring only the
   * output type makes the resolver unassignable under exactOptionalPropertyTypes. */
  const form = useForm<GenerateCarouselInput, undefined, GenerateCarouselValues>({
    resolver: zodResolver(generateCarouselSchema),
    defaultValues: {
      topic: "",
      slideCount: CAROUSEL_DEFAULT_SLIDES,
      templateId: "minimal",
      page: "portrait",
      tone: "educational",
    },
  });

  /* `useWatch` rather than `form.watch()` — the latter returns a fresh function
   * the React Compiler cannot memoize, so it skips optimising the whole
   * component. Same reasoning as the global image editor. Defaulted because
   * useWatch is typed as possibly-undefined before the first render settles. */
  const topic = useWatch({ control: form.control, name: "topic" }) ?? "";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onGenerate)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="topic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Topic</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={4}
                  placeholder="What should this carousel teach? Be specific — a concrete claim beats a broad subject."
                  disabled={disabled || isGenerating}
                />
              </FormControl>
              <FormDescription>
                {topic.length} / {CAROUSEL_TOPIC_MAX}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="slideCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slides</FormLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                  disabled={disabled || isGenerating}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SLIDE_COUNTS.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count} slides
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tone</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled || isGenerating}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {POST_TONES.map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {CAROUSEL_TONE_LABELS[tone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled || isGenerating}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CAROUSEL_TEMPLATES.map((template) => (
                      <SelectItem key={template} value={template}>
                        {CAROUSEL_TEMPLATE_LABELS[template]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="page"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shape</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled || isGenerating}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(
                      Object.keys(CAROUSEL_PAGE_PRESETS) as CarouselPagePreset[]
                    ).map((preset) => (
                      <SelectItem key={preset} value={preset}>
                        {CAROUSEL_PAGE_PRESETS[preset].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Shape changes the writing, not just the layout.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          variant="ai"
          disabled={disabled || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          {isGenerating ? "Writing slides…" : "Generate carousel"}
        </Button>
      </form>
    </Form>
  );
}
