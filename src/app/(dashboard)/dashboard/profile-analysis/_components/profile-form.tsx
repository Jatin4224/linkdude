/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileForm, ProfileFormProps
 *
 * WHAT:  The paste-your-profile form — headline, About, and optional experience.
 * WHY:   The profile is typed in rather than fetched: LinkedIn returns only
 *        `{ sub, name, picture }` under this app's scopes and blocks automated
 *        reads of profile pages, so there is no path to this text other than the
 *        user supplying it. Fields are separate rather than one blob so the
 *        prompt can address each section and the critique can point back at one.
 *        Resolves against the shared analyzeProfileSchema, so the form, the
 *        router input, and the service argument cannot drift.
 * WHERE: Rendered by profile-analyzer.tsx.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DownloadIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import {
  analyzeProfileSchema,
  fetchProfileSchema,
  type AnalyzeProfileValues,
  type FetchProfileValues,
  type FetchedProfile,
} from "@/lib/types";
import { FeatureGate } from "@/components/feature-gate";
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
import { Textarea } from "@/components/ui/textarea";

export interface ProfileFormProps {
  onAnalyze: (values: AnalyzeProfileValues) => void;
  onFetch: (values: FetchProfileValues) => void;
  isAnalyzing: boolean;
  isFetching: boolean;
  /** Result of a URL lookup — fills the fields for the user to review. */
  fetched: FetchedProfile | null;
  /** False when no vendor key is set; hides the URL tab entirely. */
  canFetchByUrl: boolean;
  disabled?: boolean;
}

export function ProfileForm({
  onAnalyze,
  onFetch,
  isAnalyzing,
  isFetching,
  fetched,
  canFetchByUrl,
  disabled = false,
}: ProfileFormProps) {
  const form = useForm<AnalyzeProfileValues>({
    resolver: zodResolver(analyzeProfileSchema),
    defaultValues: { headline: "", about: "", experience: "" },
  });

  const urlForm = useForm<FetchProfileValues>({
    resolver: zodResolver(fetchProfileSchema),
    defaultValues: { profileUrl: "" },
  });

  /* A lookup fills the same fields the user would have typed, so the review and
   * edit step is identical on both paths. `reset` rather than setValue so the
   * fields are marked pristine — a fetched profile isn't user input yet. */
  React.useEffect(() => {
    if (!fetched) return;
    form.reset({
      headline: fetched.headline,
      about: fetched.about,
      experience: fetched.experience,
    });
  }, [fetched, form]);

  const busy = isAnalyzing || isFetching || disabled;

  return (
    <div className="flex flex-col gap-5">
      {canFetchByUrl ? (
        <Form {...urlForm}>
          <form
            onSubmit={urlForm.handleSubmit(onFetch)}
            className="flex flex-col gap-3 rounded-md border p-3"
          >
            <FormField
              control={urlForm.control}
              name="profileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fetch from URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder="https://www.linkedin.com/in/your-name"
                      disabled={busy}
                    />
                  </FormControl>
                  <FormDescription>
                    Fills the fields below so you can check them before
                    analyzing.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={busy}
              className="w-full"
            >
              {isFetching ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {isFetching ? "Fetching profile..." : "Fetch profile"}
            </Button>
            {fetched?.name ? (
              /* Named so a wrong-profile fetch is obvious before it is analyzed. */
              <p className="text-sm text-muted-foreground">
                Loaded{" "}
                <span className="font-medium text-foreground">
                  {fetched.name}
                </span>{" "}
                — review the fields below, then analyze.
              </p>
            ) : null}
          </form>
        </Form>
      ) : null}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onAnalyze)}
          className="flex flex-col gap-5"
        >
          <FormField
            control={form.control}
            name="headline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Headline</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Software Engineer at Acme"
                    disabled={busy}
                  />
                </FormControl>
                <FormDescription>
                  The line under your name on LinkedIn.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="about"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={8}
                    placeholder="Paste your About section here..."
                    disabled={busy}
                    className="resize-none"
                  />
                </FormControl>
                <FormDescription>
                  Copy it straight from your profile — the analysis quotes your
                  own wording back.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="experience"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Experience{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={6}
                    placeholder="Paste a few recent roles and their descriptions..."
                    disabled={busy}
                    className="resize-none"
                  />
                </FormControl>
                <FormDescription>
                  Optional, but it makes the positioning advice noticeably
                  sharper.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Gated at the BUTTON, not the form: FeatureGate clones one child to
              intercept its onClick, and at the cap it calls preventDefault —
              which suppresses the submit — then opens the upgrade modal. Without
              this the click fires a request that comes back as a red toast, with
              no path to fixing it. The server check is unchanged; this is the
              difference between being told no and being offered the upgrade. */}
          <FeatureGate resource="profileAnalysis">
            <Button
              type="submit"
              variant="brand"
              disabled={busy}
              className="w-full"
            >
              {isAnalyzing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              Analyze Profile
            </Button>
          </FeatureGate>
        </form>
      </Form>
    </div>
  );
}
