/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ImageEditor, ImageEditorProps, ASPECT_KEYS,
 *   FIT_KEYS, FOCUS_KEYS
 *
 * WHAT:  A dialog that edits an already-uploaded image by rewriting its
 *        ImageKit `tr:` string, with a live preview of the exact delivered
 *        pixels.
 * WHY:   Edits nothing and uploads nothing — it produces a STRING. ImageKit
 *        renders transforms on demand from the URL, so the original asset is
 *        never touched and every edit stays reversible by rewriting one field.
 *        That is why this needs no service, no router, and no migration.
 *
 *        Deliberately GENERIC, like the sibling image-upload: it knows nothing
 *        about LinkedIn or posts. It takes a PostImageValues in and hands one
 *        back, so the next feature that stores an ImageKit reference reuses it.
 *
 *        The form is re-seeded on every OPEN rather than on mount, because the
 *        attached image can be replaced between openings and a stale form would
 *        show the previous image's edits against the new picture.
 * WHERE: Rendered by the post composer beside ImageUpload. Reads its vocabulary
 *        from lib/types/imagekit (buildImageTransform / parseImageTransform).
 */

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, RotateCcwIcon } from "lucide-react";

import {
  buildImageTransform,
  parseImageTransform,
  imageEditSchema,
  DEFAULT_IMAGE_EDIT,
  IMAGE_ASPECT_PRESETS,
  IMAGE_FIT_MODES,
  IMAGE_FOCUS_MODES,
  IMAGE_ROTATIONS,
  IMAGE_SHARPEN_MAX,
  IMAGE_BLUR_MAX,
  type ImageEditValues,
  type PostImageValues,
} from "@/lib/types";
import { buildTransformedUrl } from "@/lib/config";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* Iterated from the presets themselves so a new entry in lib/types appears here
 * automatically — no second list to forget to update. */
const ASPECT_KEYS = Object.keys(
  IMAGE_ASPECT_PRESETS,
) as (keyof typeof IMAGE_ASPECT_PRESETS)[];
const FIT_KEYS = Object.keys(
  IMAGE_FIT_MODES,
) as (keyof typeof IMAGE_FIT_MODES)[];
const FOCUS_KEYS = Object.keys(
  IMAGE_FOCUS_MODES,
) as (keyof typeof IMAGE_FOCUS_MODES)[];

export interface ImageEditorProps {
  /** The image to edit. Its `transform` seeds the controls. */
  value: PostImageValues;
  /** Called with the same reference carrying a rewritten `transform`. */
  onChange: (value: PostImageValues) => void;
  disabled?: boolean;
  className?: string;
  /** Trigger copy; defaults suit an image attachment. */
  label?: string;
}

export function ImageEditor({
  value,
  onChange,
  disabled = false,
  className,
  label = "Edit image",
}: ImageEditorProps) {
  const [open, setOpen] = React.useState(false);

  const form = useForm<ImageEditValues>({
    resolver: zodResolver(imageEditSchema),
    defaultValues: DEFAULT_IMAGE_EDIT,
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      value.transform
        ? parseImageTransform(value.transform)
        : DEFAULT_IMAGE_EDIT,
    );
  }, [open, value.transform, form]);

  /* Watched rather than read on submit: the preview is the whole point, so it
   * has to track every control as it moves. `useWatch` rather than
   * `form.watch()` — the latter returns a fresh function the React Compiler
   * cannot memoize, so it opts this whole component out of compilation. */
  /* Layered over the defaults because useWatch is typed as a DEEP PARTIAL — the
   * transform builder needs a complete state, and filling gaps from the same
   * defaults the form was seeded with keeps the two in step. */
  const edits: ImageEditValues = {
    ...DEFAULT_IMAGE_EDIT,
    ...useWatch({ control: form.control, defaultValue: DEFAULT_IMAGE_EDIT }),
  };
  const previewUrl = buildTransformedUrl(value.url, buildImageTransform(edits));

  /* Focus decides what survives a crop. Under pad or fit nothing is discarded,
   * so the control would be inert — disabled with a reason beats a knob that
   * silently does nothing. */
  const focusApplies = edits.fit === "crop";

  function handleApply(next: ImageEditValues) {
    onChange({ ...value, transform: buildImageTransform(next) });
    setOpen(false);
  }

  return (
    <>
      {/* Trigger rendered OUTSIDE the dialog, matching change-plan-dialog: this
          is Base UI, whose Trigger composes via `render` rather than Radix's
          `asChild`, and a plain controlled button sidesteps the difference. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        <PencilIcon className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit image</DialogTitle>
            <DialogDescription>
              Changes are non-destructive — the original upload is never
              modified.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleApply)}
              className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]"
            >
              {/* object-contain and a neutral ground: padding is part of the
                result under cm-pad_resize, so the letterboxing has to be
                visible here rather than hidden by a cropping container. */}
              <div className="flex items-center justify-center rounded-lg border bg-muted/40 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Edit preview"
                  className="max-h-88 w-full object-contain"
                />
              </div>

              <Tabs defaultValue="framing" className="min-w-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="framing">Framing</TabsTrigger>
                  <TabsTrigger value="adjust">Adjust</TabsTrigger>
                </TabsList>

                <TabsContent
                  value="framing"
                  className="mt-4 flex flex-col gap-4"
                >
                  <FormField
                    control={form.control}
                    name="aspect"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aspect</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              {/* Base UI's Select.Value renders the raw VALUE
                                  unless given children — unlike Radix, which
                                  mirrors the chosen item's text. Without this
                                  the trigger reads "linkedin", not the label. */}
                              <SelectValue>
                                {IMAGE_ASPECT_PRESETS[field.value].label}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ASPECT_KEYS.map((key) => (
                              <SelectItem key={key} value={key}>
                                {IMAGE_ASPECT_PRESETS[key].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fit</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {IMAGE_FIT_MODES[field.value].label}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FIT_KEYS.map((key) => (
                              <SelectItem key={key} value={key}>
                                {IMAGE_FIT_MODES[key].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Pad letterboxes, Crop fills and loses edges, Fit
                          shrinks to size.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="focus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Focus</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={!focusApplies}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {IMAGE_FOCUS_MODES[field.value].label}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FOCUS_KEYS.map((key) => (
                              <SelectItem key={key} value={key}>
                                {IMAGE_FOCUS_MODES[key].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!focusApplies ? (
                          <FormDescription>
                            Only applies when Fit is set to Crop.
                          </FormDescription>
                        ) : null}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rotate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rotate</FormLabel>
                        <Select
                          value={String(field.value)}
                          /* Matched against the tuple rather than cast: an
                           unparseable value falls back instead of typing a
                           bad number as a valid rotation. */
                          onValueChange={(next) =>
                            field.onChange(
                              IMAGE_ROTATIONS.find(
                                (value) => String(value) === next,
                              ) ?? 0,
                            )
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue>{field.value}&deg;</SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {IMAGE_ROTATIONS.map((value) => (
                              <SelectItem key={value} value={String(value)}>
                                {value}&deg;
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent
                  value="adjust"
                  className="mt-4 flex flex-col gap-4"
                >
                  <FormField
                    control={form.control}
                    name="grayscale"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3">
                        <FormLabel className="font-normal">Grayscale</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contrast"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between gap-3">
                        {/* Named "stretch" because e-contrast is a one-shot
                          histogram stretch, not a dial — calling it "Contrast"
                          would imply a magnitude the API does not take. */}
                        <FormLabel className="font-normal">
                          Contrast stretch
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sharpen"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="font-normal">Sharpen</FormLabel>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {field.value === 0 ? "Off" : field.value}
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            min={0}
                            max={IMAGE_SHARPEN_MAX}
                            step={1}
                            /* Base UI hands back a scalar for a single-thumb
                             slider and an array for a range one — narrowed
                             rather than indexed blind. */
                            onValueChange={(next) =>
                              field.onChange(
                                typeof next === "number"
                                  ? next
                                  : (next[0] ?? 0),
                              )
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="blur"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="font-normal">Blur</FormLabel>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {field.value === 0 ? "Off" : field.value}
                          </span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value]}
                            min={0}
                            max={IMAGE_BLUR_MAX}
                            step={1}
                            /* Base UI hands back a scalar for a single-thumb
                             slider and an array for a range one — narrowed
                             rather than indexed blind. */
                            onValueChange={(next) =>
                              field.onChange(
                                typeof next === "number"
                                  ? next
                                  : (next[0] ?? 0),
                              )
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              {/* Spans both columns so the actions sit under the whole dialog
                rather than under the narrow control rail. */}
              <DialogFooter className="md:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => form.reset(DEFAULT_IMAGE_EDIT)}
                >
                  <RotateCcwIcon className="size-4" />
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="brand">
                  Apply
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
