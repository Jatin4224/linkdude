/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanUrlStep, ContentPlanUrlStepProps
 *
 * WHAT:  The first step of the chat — the LinkedIn URL the plan is built from.
 * WHY:   A real form with a resolver rather than a bare input, because this field
 *        starts a chain that SPENDS MONEY: a vendor lookup, then a model call.
 *        `startContentPlanSchema` is the same object the router validates against,
 *        so an obvious typo — a company page, someone's personal site — is caught
 *        here for free instead of after the first charge.
 * WHERE: Rendered in the chat footer while the profile step is current.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import { startContentPlanSchema, type StartContentPlanValues } from "@/lib/types";
import { CONTENT_PLAN_STEPS } from "@/lib/config";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TechButton } from "@/components/global/tech";
import { Input } from "@/components/ui/input";

export interface ContentPlanUrlStepProps {
  onSubmit: (values: StartContentPlanValues) => void;
  /** True while the lookup or the brief is in flight. */
  isBusy: boolean;
  /** What is happening, so the button says it rather than just spinning. */
  busyLabel?: string | undefined;
  disabled?: boolean | undefined;
}

export function ContentPlanUrlStep({
  onSubmit,
  isBusy,
  busyLabel = "Reading your profile",
  disabled = false,
}: ContentPlanUrlStepProps) {
  const form = useForm<StartContentPlanValues>({
    resolver: zodResolver(startContentPlanSchema),
    defaultValues: { profileUrl: "" },
    mode: "onTouched",
  });

  const busy = isBusy || disabled;

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-3"
      >
        <FormField
          control={form.control}
          name="profileUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">LinkedIn profile URL</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="url"
                  autoComplete="url"
                  placeholder={CONTENT_PLAN_STEPS.profileUrl.placeholder}
                  disabled={busy}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <TechButton type="submit" disabled={busy}>
          {isBusy ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          {isBusy ? busyLabel : "Start"}
        </TechButton>
      </form>
    </Form>
  );
}
