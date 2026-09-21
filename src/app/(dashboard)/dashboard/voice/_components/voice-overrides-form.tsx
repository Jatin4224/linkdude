/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: VoiceOverridesForm, VoiceOverridesFormProps,
 *   voice corrections, banned phrases, voice guidance, registerLabel,
 *   emojiUseLabel
 *
 * WHAT:  The member's corrections to the extracted voice: register, emoji use,
 *        phrases never to use, and free-text notes on how they write.
 * WHY:   The model can misread a voice, and re-extracting costs a quota unit.
 *        Corrections are free, survive a re-extraction, and resolve against
 *        voiceOverridesSchema, the same schema the router validates.
 * WHERE: Rendered by voice-workspace.tsx beneath the voice card.
 */

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  VOICE_BANNED_PHRASES_MAX,
  VOICE_EMOJI_USE_OVERRIDES,
  VOICE_GUIDANCE_MAX,
  VOICE_OVERRIDE_INHERIT,
  VOICE_REGISTER_OVERRIDES,
  voiceOverridesSchema,
  type VoiceOverrides,
} from "@/lib/types";
import { VOICE_EMOJI_USE_LABELS, VOICE_REGISTER_LABELS } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { TechLabel } from "@/components/global/tech";
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
import { Textarea } from "@/components/ui/textarea";

export interface VoiceOverridesFormProps {
  defaultValues: VoiceOverrides;
  onSave: (values: VoiceOverrides) => void;
  isSaving: boolean;
  /** The member may not edit the voice, so every control renders disabled. */
  disabled?: boolean;
}

/* One wording for "leave the model's reading alone", shared by both selects. */
const INHERIT_LABEL = "Keep what was extracted";

function registerLabel(value: VoiceOverrides["register"]): string {
  return value === VOICE_OVERRIDE_INHERIT
    ? INHERIT_LABEL
    : VOICE_REGISTER_LABELS[value];
}

function emojiUseLabel(value: VoiceOverrides["emojiUse"]): string {
  return value === VOICE_OVERRIDE_INHERIT
    ? INHERIT_LABEL
    : VOICE_EMOJI_USE_LABELS[value];
}

export function VoiceOverridesForm({
  defaultValues,
  onSave,
  isSaving,
  disabled = false,
}: VoiceOverridesFormProps) {
  const form = useForm<VoiceOverrides>({
    resolver: zodResolver(voiceOverridesSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bannedPhrases",
  });

  const busy = isSaving || disabled;
  const atMax = fields.length >= VOICE_BANNED_PHRASES_MAX;

  return (
    <Card className="surface-raised">
      <CardHeader>
        <TechLabel>03 / Adjust</TechLabel>
        <CardTitle className="text-base">Corrections</CardTitle>
        <CardDescription>
          Fix anything the AI misread. Corrections are free and survive a
          re-extraction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSave)}
            className="flex flex-col gap-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="register"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Register</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        /* Parsed rather than cast: Base UI types the value
                         * loosely, and only a vocabulary member may reach the
                         * form. */
                        const parsed =
                          voiceOverridesSchema.shape.register.safeParse(value);
                        if (parsed.success) field.onChange(parsed.data);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" disabled={busy}>
                          {/* Base UI's Select.Value renders the raw VALUE
                              unless given children — see image-editor.tsx. */}
                          <SelectValue>{registerLabel(field.value)}</SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VOICE_REGISTER_OVERRIDES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {registerLabel(option)}
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
                name="emojiUse"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emoji</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        const parsed =
                          voiceOverridesSchema.shape.emojiUse.safeParse(value);
                        if (parsed.success) field.onChange(parsed.data);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" disabled={busy}>
                          <SelectValue>{emojiUseLabel(field.value)}</SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {VOICE_EMOJI_USE_OVERRIDES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {emojiUseLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Never use these phrases</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || atMax}
                  onClick={() => append({ phrase: "" })}
                >
                  <PlusIcon className="size-4" />
                  Add phrase
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None yet. Add anything you would never write, such as
                  &ldquo;game-changer&rdquo;.
                </p>
              ) : null}

              {fields.map((item, index) => (
                <FormField
                  key={item.id}
                  control={form.control}
                  name={`bannedPhrases.${index}.phrase`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            disabled={busy}
                            placeholder="A phrase to avoid"
                            aria-label={`Phrase to avoid ${index + 1}`}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          onClick={() => remove(index)}
                          aria-label={`Remove phrase ${index + 1}`}
                        >
                          <Trash2Icon className="size-4 text-muted-foreground" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="guidance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes on how you write</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      disabled={busy}
                      placeholder="For example: British spelling. Never open with a question. Keep it dry."
                      className="resize-none"
                    />
                  </FormControl>
                  <div className="flex items-start justify-between gap-2">
                    <FormDescription>
                      Applied to every draft, below the app&rsquo;s own writing
                      rules.
                    </FormDescription>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {field.value.length} / {VOICE_GUIDANCE_MAX}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={busy} className="sm:self-end">
              {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Save corrections
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
