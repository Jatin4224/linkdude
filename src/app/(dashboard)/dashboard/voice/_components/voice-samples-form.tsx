/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: VoiceSamplesForm, VoiceSamplesFormProps,
 *   emptyVoiceSample, voice samples editor, extract voice
 *
 * WHAT:  The posts a voice is learned from: paste, add, remove, pull in from
 *        published posts, and submit for extraction.
 * WHY:   Resolves against extractVoiceProfileSchema, the same schema the router
 *        validates, so a post that is too short or too little writing overall is
 *        caught in the form, before a quota unit is on the line. Presentational:
 *        the workspace owns the mutation and the suggestion fetch.
 * WHERE: Rendered by voice-workspace.tsx.
 */

import * as React from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AudioLinesIcon,
  HistoryIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import {
  VOICE_SAMPLE_MAX_CHARS,
  VOICE_SAMPLES_MAX,
  VOICE_SAMPLES_MIN,
  VOICE_TOTAL_CHARS_MIN,
  extractVoiceProfileSchema,
  type ExtractVoiceProfileValues,
  type VoiceSample,
} from "@/lib/types";
import { FeatureGate } from "@/components/feature-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

export interface VoiceSamplesFormProps {
  /** The posts the current voice came from; empty before the first extraction. */
  defaultSamples: readonly VoiceSample[];
  hasVoice: boolean;
  onExtract: (values: ExtractVoiceProfileValues) => void;
  /** Resolves to suggestions. The workspace reports failures itself. */
  onSuggest: () => Promise<VoiceSample[]>;
  isExtracting: boolean;
  /** The member may not extract, so every control renders disabled. */
  disabled?: boolean;
}

/* Fully formed rather than partial, for the reason profile-section-fields gives:
 * a partial entry makes the first keystroke validate fields not reached yet. */
function emptyVoiceSample(): VoiceSample {
  return { text: "", source: "pasted" };
}

export function VoiceSamplesForm({
  defaultSamples,
  hasVoice,
  onExtract,
  onSuggest,
  isExtracting,
  disabled = false,
}: VoiceSamplesFormProps) {
  const form = useForm<ExtractVoiceProfileValues>({
    resolver: zodResolver(extractVoiceProfileSchema),
    defaultValues: {
      /* Opens with the minimum number of boxes, so the requirement is visible as
       * layout rather than discovered as an error on submit. */
      samples:
        defaultSamples.length > 0
          ? [...defaultSamples]
          : Array.from({ length: VOICE_SAMPLES_MIN }, emptyVoiceSample),
    },
    mode: "onTouched",
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "samples",
  });
  const samples = useWatch({ control: form.control, name: "samples" });
  const [isSuggesting, setIsSuggesting] = React.useState(false);

  const busy = isExtracting || disabled;
  const atMax = fields.length >= VOICE_SAMPLES_MAX;
  const totalChars = samples.reduce(
    (total, sample) => total + sample.text.trim().length,
    0,
  );
  /* The list-level rules (how many posts, how much writing) belong to no single
   * box, so they are shown once under the list. */
  const listError =
    form.formState.errors.samples?.message ??
    form.formState.errors.samples?.root?.message;

  /* Suggestions fill the list rather than sit beside it: blank boxes are dropped
   * and duplicates skipped, so pulling posts twice never doubles them. */
  async function addSuggestions() {
    setIsSuggesting(true);
    try {
      const suggestions = await onSuggest();
      const kept = form
        .getValues("samples")
        .filter((sample) => sample.text.trim().length > 0);
      const seen = new Set(kept.map((sample) => sample.text.trim()));
      const additions = suggestions.filter(
        (sample) => !seen.has(sample.text.trim()),
      );
      if (additions.length > 0) {
        replace([...kept, ...additions].slice(0, VOICE_SAMPLES_MAX));
      }
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <Card className="surface-raised h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
            <AudioLinesIcon className="size-4" />
          </span>
          Posts to learn from
        </CardTitle>
        <CardDescription>
          Paste at least {VOICE_SAMPLES_MIN} posts you wrote yourself. More posts
          give a sharper voice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onExtract)}
            className="flex flex-col gap-4"
          >
            {fields.map((item, index) => (
              <FormField
                key={item.id}
                control={form.control}
                name={`samples.${index}.text`}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel className="flex items-center gap-2">
                        Post {index + 1}
                        {item.source === "linkedinPost" ? (
                          <Badge variant="outline">Published here</Badge>
                        ) : null}
                      </FormLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => remove(index)}
                        aria-label={`Remove post ${index + 1}`}
                      >
                        <Trash2Icon className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={5}
                        disabled={busy}
                        placeholder="Paste a post exactly as you wrote it…"
                        className="resize-none"
                      />
                    </FormControl>
                    <div className="flex items-start justify-between gap-2">
                      <FormMessage />
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {field.value.length} / {VOICE_SAMPLE_MAX_CHARS}
                      </span>
                    </div>
                  </FormItem>
                )}
              />
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || atMax}
                onClick={() => append(emptyVoiceSample())}
              >
                <PlusIcon className="size-4" />
                Add post
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || isSuggesting || atMax}
                onClick={() => void addSuggestions()}
              >
                {isSuggesting ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <HistoryIcon className="size-4" />
                )}
                Add my published posts
              </Button>
            </div>
            {/* Named because it is the one way this form quietly produces a worse
                voice: posts drafted by the app carry the app's style. */}
            <p className="text-xs text-muted-foreground">
              Posts drafted in this app sound like the app. Keep the ones you
              wrote yourself or edited heavily.
            </p>

            <div className="flex items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
              <span>
                {totalChars.toLocaleString()} characters across {fields.length}{" "}
                posts
              </span>
              <span>{VOICE_TOTAL_CHARS_MIN.toLocaleString()}+ needed</span>
            </div>
            {listError ? (
              <p className="text-sm text-destructive">{listError}</p>
            ) : null}

            <FeatureGate resource="voiceProfile">
              <Button
                type="submit"
                variant="brand"
                className="w-full"
                disabled={busy}
              >
                {isExtracting ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <AudioLinesIcon className="size-4" />
                )}
                {hasVoice ? "Re-extract my voice" : "Extract my voice"}
              </Button>
            </FeatureGate>
            {disabled ? (
              <p className="text-center text-xs text-muted-foreground">
                Your role can&rsquo;t extract a voice in this workspace.
              </p>
            ) : hasVoice ? (
              <p className="text-center text-xs text-muted-foreground">
                Re-extracting uses one voice extraction from your plan. You can
                switch back to the previous voice afterwards.
              </p>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
