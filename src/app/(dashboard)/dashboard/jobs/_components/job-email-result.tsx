/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: JobEmailResult, JobEmailResultProps, job email
 *   editor, open in Gmail, placeholders to fill, placeholder chips, rewrite
 *   buttons, undo rewrite, sign-off field
 *
 * WHAT:  The generated draft, editable: the match check, recipient, subject,
 *        email body, sign-off and a LinkedIn message, with one-click rewrites
 *        and buttons to open it in Gmail or the member's email app, or copy it.
 * WHY:   The member always reviews before sending, so the draft is a form
 *        validated by jobEmailDraftSchema rather than static text.
 *
 *        Every [placeholder] left in the draft is a chip that jumps to and
 *        selects it, so filling one in is a click and a keystroke; sending one by
 *        accident is the easiest way this feature could embarrass someone.
 *
 *        Rewrites send the draft as it is NOW, so filled placeholders survive,
 *        and keep one step of undo, because a rewrite replaces text the member
 *        may have edited. The sign-off is never part of a rewrite.
 *
 *        Sending happens in the member's own mail client (decided 2026-09-15):
 *        no Google approval, and the email comes from their real address.
 * WHERE: Rendered by job-assist-workspace.tsx, remounted for each new draft.
 */

import * as React from "react";
import { flushSync } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MailIcon,
  Undo2Icon,
} from "lucide-react";

import {
  JOB_EMAIL_REWRITE_LABELS,
  JOB_PLACEHOLDER_PATTERN,
  buildGmailComposeUrl,
  buildMailtoUrl,
  composeEmailBody,
} from "@/lib/config";
import {
  JOB_EMAIL_BODY_MAX,
  JOB_EMAIL_REWRITE_INSTRUCTIONS,
  JOB_LINKEDIN_MESSAGE_MAX,
  jobEmailDraftSchema,
  type JobEmailDraftValues,
  type JobEmailRewriteInstruction,
  type RewriteJobEmailDraftValues,
} from "@/lib/types";
import { FeatureGate } from "@/components/feature-gate";
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
import { JobMatchCheck } from "./job-match-check";
import type { JobEmailResultData, JobEmailRewriteResultData } from "./job-types";

export interface JobEmailResultProps {
  draft: JobEmailResultData;
  /** Resolves with the rewritten text; rejects after the workspace has shown why. */
  onRewrite: (
    values: RewriteJobEmailDraftValues,
  ) => Promise<JobEmailRewriteResultData>;
  /** The rewrite in flight, or null when none is. */
  rewritingInstruction: JobEmailRewriteInstruction | null;
}

export function JobEmailResult({
  draft,
  onRewrite,
  rewritingInstruction,
}: JobEmailResultProps) {
  const form = useForm<JobEmailDraftValues>({
    resolver: zodResolver(jobEmailDraftSchema),
    defaultValues: {
      recipientEmail: draft.recipientEmail,
      subject: draft.subject,
      body: draft.body,
      signature: draft.signature,
      linkedinMessage: draft.linkedinMessage,
    },
    mode: "onChange",
  });

  const [tab, setTab] = React.useState("email");
  /* The draft text before the last rewrite, for one step of undo. */
  const [previousDraft, setPreviousDraft] =
    React.useState<JobEmailDraftValues | null>(null);

  const subjectRef = React.useRef<HTMLInputElement | null>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);
  const signatureRef = React.useRef<HTMLTextAreaElement | null>(null);
  const linkedinMessageRef = React.useRef<HTMLTextAreaElement | null>(null);

  const [recipientEmail, subject, body, signature, linkedinMessage] = useWatch({
    control: form.control,
    name: ["recipientEmail", "subject", "body", "signature", "linkedinMessage"],
  });

  /* Every placeholder still in the draft, listed once each. */
  const placeholders = [
    ...new Set(
      [subject, body, signature, linkedinMessage].flatMap(
        (text) => text.match(JOB_PLACEHOLDER_PATTERN) ?? [],
      ),
    ),
  ];
  const isRewriting = rewritingInstruction !== null;

  /* Opens the tab holding the placeholder, then selects it so typing replaces
   * it. flushSync commits the tab switch first, so the field is on screen and
   * can take focus. */
  function selectPlaceholder(placeholder: string) {
    const values = form.getValues();
    const target = [
      { tab: "email", text: values.subject, ref: subjectRef },
      { tab: "email", text: values.body, ref: bodyRef },
      { tab: "email", text: values.signature, ref: signatureRef },
      { tab: "linkedin", text: values.linkedinMessage, ref: linkedinMessageRef },
    ].find(({ text }) => text.includes(placeholder));
    if (!target) return;

    flushSync(() => setTab(target.tab));
    const element = target.ref.current;
    if (!element) return;
    const start = target.text.indexOf(placeholder);
    element.focus();
    element.setSelectionRange(start, start + placeholder.length);
  }

  function setDraftText({
    subject: nextSubject,
    body: nextBody,
    linkedinMessage: nextLinkedinMessage,
  }: JobEmailDraftValues | JobEmailRewriteResultData) {
    const options = { shouldDirty: true, shouldValidate: true };
    form.setValue("subject", nextSubject, options);
    form.setValue("body", nextBody, options);
    form.setValue("linkedinMessage", nextLinkedinMessage, options);
  }

  async function rewrite(instruction: JobEmailRewriteInstruction) {
    const valid = await form.trigger(["subject", "body", "linkedinMessage"]);
    if (!valid) return;
    const current = form.getValues();
    try {
      const rewritten = await onRewrite({
        instruction,
        subject: current.subject,
        body: current.body,
        linkedinMessage: current.linkedinMessage,
      });
      setPreviousDraft(current);
      setDraftText(rewritten);
    } catch {
      /* The workspace has already shown the error; the draft is untouched. */
    }
  }

  function undoRewrite() {
    if (!previousDraft) return;
    setDraftText(previousDraft);
    setPreviousDraft(null);
  }

  /* Validates before leaving the page, so Gmail never opens with an empty
   * subject or a malformed address. */
  async function openDraft(buildUrl: typeof buildGmailComposeUrl, newTab: boolean) {
    const valid = await form.trigger([
      "recipientEmail",
      "subject",
      "body",
      "signature",
    ]);
    if (!valid) return;
    const url = buildUrl(form.getValues());
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
          {draft.contactName ? `Addressed to ${draft.contactName}. ` : ""}
          Read it, fix anything that isn&rsquo;t right, then send it from your own
          inbox.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={(event) => event.preventDefault()}
            noValidate
            className="flex flex-col gap-4"
          >
            <JobMatchCheck
              matched={draft.matchedRequirements}
              missing={draft.missingRequirements}
            />

            {placeholders.length > 0 ? (
              <Alert>
                <AlertTriangleIcon className="size-4" />
                <AlertTitle>Fill these in before sending</AlertTitle>
                <AlertDescription>
                  Click one to jump to it, then type to replace it.
                </AlertDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {placeholders.map((placeholder) => (
                    <Button
                      key={placeholder}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => selectPlaceholder(placeholder)}
                    >
                      {placeholder}
                    </Button>
                  ))}
                </div>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Rewrite
              </span>
              {JOB_EMAIL_REWRITE_INSTRUCTIONS.map((instruction) => (
                <FeatureGate key={instruction} resource="jobEmailRewrites">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRewriting}
                    onClick={() => void rewrite(instruction)}
                  >
                    {rewritingInstruction === instruction ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : null}
                    {JOB_EMAIL_REWRITE_LABELS[instruction]}
                  </Button>
                </FeatureGate>
              ))}
              {previousDraft ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRewriting}
                  onClick={undoRewrite}
                >
                  <Undo2Icon className="size-3.5" />
                  Undo
                </Button>
              ) : null}
            </div>

            <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
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
                        <Input
                          {...field}
                          ref={(element) => {
                            field.ref(element);
                            subjectRef.current = element;
                          }}
                          readOnly={isRewriting}
                        />
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
                        <Textarea
                          {...field}
                          ref={(element) => {
                            field.ref(element);
                            bodyRef.current = element;
                          }}
                          rows={12}
                          readOnly={isRewriting}
                          className="resize-y"
                        />
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

                <FormField
                  control={form.control}
                  name="signature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sign-off</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          ref={(element) => {
                            field.ref(element);
                            signatureRef.current = element;
                          }}
                          rows={4}
                          className="resize-y"
                        />
                      </FormControl>
                      <FormDescription>
                        Built from About me. Edit it for this email; rewrites never
                        change it.
                      </FormDescription>
                      <FormMessage />
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
                    text={`Subject: ${subject}\n\n${composeEmailBody(body, signature)}`}
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
                        <Textarea
                          {...field}
                          ref={(element) => {
                            field.ref(element);
                            linkedinMessageRef.current = element;
                          }}
                          rows={5}
                          readOnly={isRewriting}
                          className="resize-y"
                        />
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
