/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: JobEmailResult, JobEmailResultProps, job email
 *   editor, open in Gmail, placeholders to fill
 *
 * WHAT:  The generated draft, editable: recipient, subject, email body and a
 *        LinkedIn message, with buttons to open it in Gmail or the member's email
 *        app, or copy it.
 * WHY:   The member always reviews before sending, so the draft is a form
 *        validated by jobEmailDraftSchema rather than static text. Any
 *        [placeholder] the AI left for a missing fact is listed above the send
 *        buttons, because sending one by accident is the easiest way this
 *        feature could embarrass someone.
 *
 *        Sending happens in the member's own mail client (decided 2026-09-15):
 *        no Google approval, and the email comes from their real address.
 * WHERE: Rendered by job-assist-workspace.tsx, remounted for each new draft.
 */

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, ExternalLinkIcon, MailIcon } from "lucide-react";

import {
  JOB_PLACEHOLDER_PATTERN,
  buildGmailComposeUrl,
  buildMailtoUrl,
} from "@/lib/config";
import {
  JOB_EMAIL_BODY_MAX,
  JOB_LINKEDIN_MESSAGE_MAX,
  jobEmailDraftSchema,
  type JobEmailDraftValues,
} from "@/lib/types";
import { CopyButton } from "@/components/global/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { JobEmailResultData } from "./job-types";

export interface JobEmailResultProps {
  draft: JobEmailResultData;
}

export function JobEmailResult({ draft }: JobEmailResultProps) {
  const form = useForm<JobEmailDraftValues>({
    resolver: zodResolver(jobEmailDraftSchema),
    defaultValues: {
      recipientEmail: draft.recipientEmail,
      subject: draft.subject,
      body: draft.body,
      linkedinMessage: draft.linkedinMessage,
    },
    mode: "onChange",
  });

  const [recipientEmail, subject, body, linkedinMessage] = useWatch({
    control: form.control,
    name: ["recipientEmail", "subject", "body", "linkedinMessage"],
  });

  /* Every placeholder still in the draft, listed once each. */
  const placeholders = [
    ...new Set(
      [subject, body, linkedinMessage].flatMap(
        (text) => text.match(JOB_PLACEHOLDER_PATTERN) ?? [],
      ),
    ),
  ];

  /* Validates before leaving the page, so Gmail never opens with an empty
   * subject or a malformed address. */
  async function openDraft(buildUrl: typeof buildGmailComposeUrl, newTab: boolean) {
    const valid = await form.trigger(["recipientEmail", "subject", "body"]);
    if (!valid) return;
    const values = form.getValues();
    const url = buildUrl(values);
    if (newTab) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(url);
    }
  }

  const heading = [draft.role, draft.company].filter(Boolean).join(" at ");

  return (
    <Card className="surface-raised">
      <CardHeader>
        <CardTitle className="text-base">{heading || "Your email"}</CardTitle>
        <CardDescription>
          Read it, fix anything that isn&rsquo;t right, then send it from your own
          inbox.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
            {placeholders.length > 0 ? (
              <Alert>
                <AlertTriangleIcon className="size-4" />
                <AlertTitle>Fill these in before sending</AlertTitle>
                <AlertDescription>{placeholders.join(", ")}</AlertDescription>
              </Alert>
            ) : null}

            <Tabs defaultValue="email">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="linkedin">LinkedIn message</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="mt-4 flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="hiring@company.com" />
                      </FormControl>
                      {!recipientEmail ? (
                        <FormDescription>
                          No address in the post. Add one if you have it, or send
                          the LinkedIn message instead.
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={12} className="resize-y" />
                      </FormControl>
                      <div className="flex items-start justify-between gap-2">
                        <FormMessage />
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {field.value.length} / {JOB_EMAIL_BODY_MAX}
                        </span>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="brand"
                    onClick={() => void openDraft(buildGmailComposeUrl, true)}
                  >
                    <ExternalLinkIcon className="size-4" />
                    Open in Gmail
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void openDraft(buildMailtoUrl, false)}
                  >
                    <MailIcon className="size-4" />
                    Open in email app
                  </Button>
                  <CopyButton
                    text={`Subject: ${subject}\n\n${body}`}
                    label="email"
                  />
                </div>
              </TabsContent>

              <TabsContent value="linkedin" className="mt-4 flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="linkedinMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn message</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={5} className="resize-y" />
                      </FormControl>
                      <FormDescription>
                        Short enough to send as a connection note or a direct
                        message to the person who posted.
                      </FormDescription>
                      <div className="flex items-start justify-between gap-2">
                        <FormMessage />
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {field.value.length} / {JOB_LINKEDIN_MESSAGE_MAX}
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
                <div>
                  <CopyButton text={linkedinMessage} label="LinkedIn message" />
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
