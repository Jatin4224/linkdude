/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: CarouselForm, CarouselFormProps,
 *   CAROUSEL_TEMPLATE_LABELS, POST_TONE_LABELS
 *
 * WHAT:  The generate form — topic, deck length, tone, template and page shape.
 * WHY:   Resolves against generateCarouselSchema, the same schema the router
 *        validates with, so the browser and the server cannot disagree about what
 *        a valid brief is. Every bound (topic length, slide count) comes from the
 *        exported constants rather than being restated here, so the counter under
 *        the textarea and the error that blocks submit always quote one number.
 * WHERE: Rendered inside the new-carousel dialog on the carousel workspace.
 */

import * as React from "react";
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
  type CarouselPagePreset,
} from "@/lib/types";
import {
  CAROUSEL_GENERATION_PHASES,
  CAROUSEL_SAMPLE_TOPICS,
  CAROUSEL_TEMPLATE_LABELS,
  POST_TONE_LABELS,
} from "@/lib/config";
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

/* Template labels moved to lib/config/carousel when the editor's own template
 * switcher became a second consumer — two copies of a label map drift the first
 * time one is reworded. Tone labels are shared with the post composer for the same
 * reason and live in POST_TONE_LABELS. */

/**
 * SOURCE OF TRUTH KEYWORDS: useGenerationLabel, CAROUSEL_GENERATION_PHASES
 *
 * WHAT:  The label on the submit button while a deck is being written.
 * WHY:   TIME-BASED, NOT PROGRESS-BASED — generation is one opaque model call that
 *        knows nothing about its own phase, so there is no honest percentage to
 *        report. The phases exist to show the wait is ordered and bounded, which is
 *        all a truthful indicator can claim.
 *
 *        The clock is read ONLY inside the effect and its timer callback — never
 *        during render, which has to stay pure, and never as a synchronous setState
 *        in an effect body. Both are lint errors here and both rules are right: the
 *        first makes a render's output depend on when it happened, the second
 *        cascades a render every time the dialog opens.
 *
 *        Each generation is therefore STAMPED with a run id, and a reading left over
 *        from an earlier run is ignored rather than cleared. That is what stops a
 *        second attempt after a failure from opening on the previous run's last
 *        label, without anything having to reset state at the wrong moment.
 */
function useGenerationLabel(isGenerating: boolean): string {
  const [runId, setRunId] = React.useState(0);
  const [wasGenerating, setWasGenerating] = React.useState(false);
  const [reading, setReading] = React.useState<{
    runId: number;
    elapsedMs: number;
  } | null>(null);

  /* Previous-value marker adjusted during render, the pattern carousel-workspace
   * uses to reset its buffer. Pure — an updater function, no clock. */
  if (isGenerating !== wasGenerating) {
    setWasGenerating(isGenerating);
    if (isGenerating) setRunId((current) => current + 1);
  }

  React.useEffect(() => {
    if (!isGenerating) return;
    const startedAt = Date.now();
    /* setState in a timer CALLBACK, not in the effect body — the distinction the
     * lint rule draws, and the one it exists for. */
    const timer = setInterval(() => {
      setReading({ runId, elapsedMs: Date.now() - startedAt });
    }, 400);
    return () => clearInterval(timer);
  }, [isGenerating, runId]);

  /* A reading from a previous run is stale, so it reads as zero and the first phase
   * wins — which is also the state on the very first frame, before any tick. */
  const elapsedMs = reading?.runId === runId ? reading.elapsedMs : 0;

  /* The last phase whose threshold has passed; reduced rather than found from the
   * end so the first entry always wins at zero.
   *
   * Explicit accumulator type: without it the initial value's literal type narrows
   * the result and the later labels are unassignable. */
  return CAROUSEL_GENERATION_PHASES.reduce<string>(
    (label, phase) => (elapsedMs >= phase.atMs ? phase.label : label),
    CAROUSEL_GENERATION_PHASES[0].label,
  );
}

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
  const generatingLabel = useGenerationLabel(isGenerating);

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

              {/* Offered only while the box is empty. An empty prompt field is the
                  hardest screen in the product — it asks for a format nobody has
                  seen yet — and these double as instruction, showing that a
                  concrete claim beats a broad subject. They vanish once there is
                  something to lose. */}
              {topic.length === 0 ? (
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">
                    Or start from one of these:
                  </span>
                  {CAROUSEL_SAMPLE_TOPICS.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      disabled={disabled || isGenerating}
                      onClick={() =>
                        form.setValue("topic", sample, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      className="rounded-md border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              ) : null}
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
                      {/* Base UI's Select.Value renders the raw VALUE unless
                          given children — see the note in image-editor.tsx. */}
                      <SelectValue>
                        {field.value ?? CAROUSEL_DEFAULT_SLIDES} slides
                      </SelectValue>
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
                      <SelectValue>
                        {field.value ? POST_TONE_LABELS[field.value] : null}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {POST_TONES.map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {POST_TONE_LABELS[tone]}
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
                      <SelectValue>
                        {field.value
                          ? CAROUSEL_TEMPLATE_LABELS[field.value]
                          : null}
                      </SelectValue>
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
                      <SelectValue>
                        {field.value
                          ? CAROUSEL_PAGE_PRESETS[field.value].label
                          : null}
                      </SelectValue>
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
          {isGenerating ? generatingLabel : "Generate carousel"}
        </Button>
      </form>
    </Form>
  );
}
