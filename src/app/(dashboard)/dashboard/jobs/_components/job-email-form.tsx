/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: JobEmailForm, JobEmailFormProps, hiring post form,
 *   job notes, company and role
 *
 * WHAT:  The request for one job: the pasted hiring post, the role and company
 *        when the post doesn't name them, notes that only matter for this job,
 *        and optionally the recruiter's email address.
 * WHY:   Resolved against generateJobEmailSchema, the schema jobEmails.create
 *        validates, so a too-short post is caught before a quota unit is spent.
 *        The member's standing facts live in the About me card, so this form
 *        only asks about the job in front of them.
 * WHERE: Rendered by job-assist-workspace.tsx.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import {
  DEFAULT_JOB_EMAIL_REQUEST,
  JOB_HIGHLIGHTS_MAX,
  JOB_POST_MAX,
  generateJobEmailSchema,
  type GenerateJobEmailValues,
} from "@/lib/types";
import { FeatureGate } from "@/components/feature-gate";
import { VoiceStatusLine } from "@/components/global/voice-status";
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

export interface JobEmailFormProps {
  onGenerate: (values: GenerateJobEmailValues) => void;
  isGenerating: boolean;
}

export function JobEmailForm({ onGenerate, isGenerating }: JobEmailFormProps) {
  const form = useForm<GenerateJobEmailValues>({
    resolver: zodResolver(generateJobEmailSchema),
    defaultValues: DEFAULT_JOB_EMAIL_REQUEST,
    mode: "onTouched",
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onGenerate)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="jobPost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hiring post</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={8}
                  placeholder="Paste the whole post or job description, including any email address in it."
                  disabled={isGenerating}
                  className="resize-none"
                />
              </FormControl>
              <div className="flex items-start justify-between gap-2">
                <FormMessage />
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {field.value.length} / {JOB_POST_MAX}
                </span>
              </div>
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role (optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Frontend Engineer"
                      disabled={isGenerating}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Acme" disabled={isGenerating} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Only needed when the post doesn&rsquo;t say.
          </p>
        </div>

        <FormField
          control={form.control}
          name="highlights"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes for this job (optional)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="I've used their app for two years. A friend on their team referred me."
                  disabled={isGenerating}
                  className="resize-none"
                />
              </FormControl>
              <FormDescription>
                Your About me details are used automatically. Add only what matters
                for this job. {field.value.length} / {JOB_HIGHLIGHTS_MAX}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="recipientEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recruiter&rsquo;s email (optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="hiring@company.com"
                  disabled={isGenerating}
                />
              </FormControl>
              <FormDescription>
                Leave empty if it&rsquo;s in the post; the AI picks it up.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FeatureGate resource="jobEmails">
          <Button
            type="submit"
            variant="brand"
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SparklesIcon className="size-4" />
            )}
            Write my email
          </Button>
        </FeatureGate>

        <VoiceStatusLine />
      </form>
    </Form>
  );
}
