/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: JobAssistWorkspace, Job Assist, job email writer
 *   page, jobEmails.create, jobEmailRewrites.create
 *
 * WHAT:  The /dashboard/jobs surface: the About me card on top, then the hiring
 *        post on one side and the editable email and LinkedIn message on the
 *        other.
 * WHY:   Two columns like the post composer, because a member reads the draft
 *        against the post they pasted and regenerates without losing either.
 *        This component owns both model mutations; the form and the result
 *        editor stay presentational.
 *
 *        A rewrite is sent with the post and notes the CURRENT draft was written
 *        from (the last generate's variables), not whatever the form holds now,
 *        so a half-edited post can't change the facts under an existing draft.
 * WHERE: Rendered by the jobs page. RESOURCES.jobEmails.nav.href.
 */

import * as React from "react";
import { BriefcaseIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";
import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { ContentLayout } from "@/components/global/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CandidateProfileCard } from "./candidate-profile-card";
import { JobEmailForm } from "./job-email-form";
import { JobEmailResult } from "./job-email-result";

export function JobAssistWorkspace() {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();
  /* Bumped on every new draft, so the result editor reseeds with it instead of
   * keeping edits made to the previous one. */
  const [draftVersion, setDraftVersion] = React.useState(0);

  const generate = trpc.jobEmails.create.useMutation({
    onSuccess: async () => {
      setDraftVersion((version) => version + 1);
      /* Usage too: each email spends a unit from the plan. */
      await utils.usage.invalidate();
      toast.success("Email ready. Check it, then open it in Gmail.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const rewrite = trpc.jobEmailRewrites.create.useMutation({
    onSuccess: async () => {
      /* Rewrites spend their own allowance, separate from emails. */
      await utils.usage.invalidate();
      toast.success("Rewritten. Undo brings the last version back.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!organizationId) return null;

  const draft = generate.data;
  const request = generate.variables;

  return (
    <ContentLayout
      title="Job Assist"
      description="Turn a hiring post into an email a recruiter will actually read"
      icon={<BriefcaseIcon className="size-4" />}
    >
      <div className="flex flex-col gap-6">
        <CandidateProfileCard />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <Card className="surface-raised h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
                  <BriefcaseIcon className="size-4" />
                </span>
                The hiring post
              </CardTitle>
              <CardDescription>
                Paste the post and generate. Your About me details are used
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JobEmailForm
                onGenerate={(values) =>
                  generate.mutate({ ...values, organizationId })
                }
                isGenerating={generate.isPending}
              />
            </CardContent>
          </Card>

          {draft && request ? (
            <JobEmailResult
              key={draftVersion}
              draft={draft}
              onRewrite={(values) =>
                rewrite.mutateAsync({
                  ...values,
                  jobPost: request.jobPost,
                  highlights: request.highlights,
                  organizationId,
                })
              }
              rewritingInstruction={
                rewrite.isPending ? (rewrite.variables?.instruction ?? null) : null
              }
            />
          ) : (
            <Card className="surface-raised">
              <CardHeader>
                <CardTitle className="text-base">Your email</CardTitle>
                <CardDescription>
                  It appears here with a match check, ready to edit, rewrite and
                  open in Gmail. There&rsquo;s also a short LinkedIn message for
                  posts without an email address.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </ContentLayout>
  );
}
