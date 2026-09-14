/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: CandidateProfileCard, CandidateProfileForm, About
 *   me card, candidateProfile.get, candidateProfile.update, saved job details,
 *   sign-off details, skills, experience, portfolio link
 *
 * WHAT:  A collapsible "About me" card at the top of Job Assist: the member's
 *        skills, experience, education, links and phone, saved once and used in
 *        every job email.
 * WHY:   Retyping the same facts for every application was the main friction in
 *        v1. The card opens on a first visit, so the member sees what makes an
 *        email specific, and folds away once saved. The panel stays mounted while
 *        folded, so half-typed details are never lost.
 *
 *        Split in two so the form seeds from the saved details once they load,
 *        instead of resetting itself from an effect.
 * WHERE: Rendered at the top of job-assist-workspace.tsx.
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronDownIcon,
  Loader2Icon,
  SaveIcon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { permissions } from "@/lib/better-auth/permissions";
import { getErrorMessage } from "@/lib/errors";
import {
  CANDIDATE_EXPERIENCE_MAX,
  DEFAULT_CANDIDATE_PROFILE,
  candidateProfileSchema,
  type CandidateProfileValues,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function CandidateProfileCard() {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();
  const canRead = hasPermission(permissions.CANDIDATE_PROFILE_READ);
  const canUpdate = hasPermission(permissions.CANDIDATE_PROFILE_UPDATE);

  /* Asked only with the permission, so a restricted role sees no card rather
   * than a failed request. */
  const profileQuery = trpc.candidateProfile.get.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: organizationId !== undefined && canRead, retry: false },
  );

  if (!organizationId || !canRead || profileQuery.data === undefined) {
    return null;
  }

  return (
    <CandidateProfileForm
      organizationId={organizationId}
      savedProfile={profileQuery.data.profile}
      accountName={profileQuery.data.accountName}
      canUpdate={canUpdate}
    />
  );
}

export interface CandidateProfileFormProps {
  organizationId: string;
  savedProfile: CandidateProfileValues | null;
  accountName: string;
  canUpdate: boolean;
}

function CandidateProfileForm({
  organizationId,
  savedProfile,
  accountName,
  canUpdate,
}: CandidateProfileFormProps) {
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = React.useState(savedProfile === null);

  const form = useForm<CandidateProfileValues>({
    resolver: zodResolver(candidateProfileSchema),
    /* First visit starts from the account name, so no one types it twice. */
    defaultValues: savedProfile ?? {
      ...DEFAULT_CANDIDATE_PROFILE,
      fullName: accountName,
    },
    mode: "onTouched",
  });

  const save = trpc.candidateProfile.update.useMutation({
    onSuccess: async () => {
      await utils.candidateProfile.get.invalidate();
      toast.success("Saved. Every new email uses these details.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function onSubmit(values: CandidateProfileValues) {
    save.mutate(
      { ...values, organizationId },
      {
        onSuccess: () => {
          /* The saved values become the new baseline for "unsaved changes". */
          form.reset(values);
          setIsOpen(false);
        },
      },
    );
  }

  const summary = savedProfile
    ? [savedProfile.fullName, savedProfile.headline].filter(Boolean).join(" · ")
    : "Save your details once. Every email uses your real experience and ends with your links.";
  const isLocked = !canUpdate || save.isPending;

  return (
    <Collapsible open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <Card className="surface-raised">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
              <UserRoundIcon className="size-4" />
            </span>
            About me
          </CardTitle>
          <CardDescription className="truncate">{summary}</CardDescription>
          <CardAction>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" size="sm" />}
            >
              {isOpen ? "Hide" : savedProfile ? "Edit" : "Set up"}
              <ChevronDownIcon
                className={cn("size-4 transition-transform", isOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
          </CardAction>
        </CardHeader>

        <CollapsibleContent keepMounted>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                noValidate
                className="flex flex-col gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isLocked} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="headline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current role</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Frontend developer at Acme"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skills</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder="React, TypeScript, Next.js, PostgreSQL, Figma"
                          disabled={isLocked}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience and projects</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={5}
                          placeholder="4 years building web apps. Rebuilt the checkout at Acme and cut drop-off by 22%. Side project: an open-source form library with 2k GitHub stars."
                          disabled={isLocked}
                          className="resize-y"
                        />
                      </FormControl>
                      <FormDescription>
                        Only what&rsquo;s true, with numbers where you have them. The
                        AI never adds anything that isn&rsquo;t here.{" "}
                        {field.value.length} / {CANDIDATE_EXPERIENCE_MAX}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="education"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Education</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="B.Tech Computer Science, 2022"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Bengaluru, open to remote"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="availability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Can start in 2 weeks"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="linkedinUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="url"
                            placeholder="https://linkedin.com/in/you"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="portfolioUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portfolio</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="url"
                            placeholder="https://you.dev"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="githubUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="url"
                            placeholder="https://github.com/you"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid items-start gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            placeholder="+91 98765 43210"
                            disabled={isLocked}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="includePhone"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-3 rounded-lg border p-3 sm:mt-6">
                        <div className="flex flex-col gap-0.5">
                          <FormLabel>Add phone to sign-off</FormLabel>
                          <FormDescription>Off unless you turn it on.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked)}
                            disabled={isLocked}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Links and phone go into the sign-off exactly as saved. The AI
                    never writes them.
                  </p>
                  <Button
                    type="submit"
                    variant="brand"
                    disabled={
                      isLocked ||
                      (savedProfile !== null && !form.formState.isDirty)
                    }
                  >
                    {save.isPending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <SaveIcon className="size-4" />
                    )}
                    Save details
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
