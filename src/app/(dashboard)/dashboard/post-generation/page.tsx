/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostGenerationPage, parseInitialDate, loadDraftSeed,
 *   loadIdeaSeed, ideaId
 *
 * WHAT:  /dashboard/post-generation route — thin shell; PostComposer does the
 *        work.
 * WHY:   Reads the ImageKit / scheduler config HERE and passes it down, because
 *        those checks read server-only env vars and would silently evaluate to
 *        false inside the client composer — hiding both features on a correctly
 *        configured install. A server component is the only place they can be
 *        answered honestly.
 *
 *        A reopened draft is loaded here for the same family of reasons: the
 *        composer holds its text and image in useState, and state seeded from a
 *        client fetch would need an effect that overwrites whatever the user had
 *        already typed. Resolved server-side, the draft is simply the form's
 *        initial value — the pattern `?date=` already uses below.
 * WHERE: RESOURCES.linkedinPosts.nav.href. Linked to with `?draftId=` by the post
 *        library's Edit action.
 */

import type { Metadata } from "next";

import {
  isAiImageConfigured,
  isImageKitConfigured,
  isSchedulerConfigured,
} from "@/lib/config";
import { createTRPCContext } from "@/trpc/init";
import { getQueryClient, trpc } from "@/trpc/server";
import type { LinkedInPostStatus } from "@/lib/types";
import {
  PostComposer,
  type PostDraftSeed,
  type PostIdeaSeed,
} from "./_components/post-composer";

export const metadata: Metadata = {
  title: "Create Post",
};

/* Parsed here rather than in the client: an unparseable or attacker-supplied
 * `?date=` becomes undefined and the composer simply opens in immediate mode,
 * instead of seeding an Invalid Date into a form control. */
function parseInitialDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * SOURCE OF TRUTH KEYWORDS: loadDraftSeed
 *
 * WHAT:  Resolves `?draftId=` to the values the composer should open with, or
 *        null.
 * WHY:   Goes through `linkedinPosts.get`, not the service, so the id is scoped
 *        to the caller's active organization and checked against the same read
 *        permission as everything else — a guessed cuid resolves to nothing.
 *        `createTRPCContext` is request-cached, so the auth and membership
 *        lookups the dashboard layout already did are reused rather than repeated.
 *
 *        EVERY failure opens a blank composer instead of an error page: a stale
 *        bookmark to a draft that has since been published or discarded should
 *        cost the user a link, not the screen.
 */
async function loadDraftSeed(
  draftId: string | undefined,
): Promise<PostDraftSeed | null> {
  if (!draftId) return null;

  const ctx = await createTRPCContext();
  await ctx.resolveAuth();
  const organization = await ctx.getActiveOrganization();
  if (!organization) return null;

  try {
    const post = await getQueryClient().fetchQuery(
      trpc.linkedinPosts.get.queryOptions({
        organizationId: organization.id,
        postId: draftId,
      }),
    );
    /* Only a draft may be reopened. A published post's copy lives on LinkedIn and
     * cannot be corrected, so loading one into an editor would only invite an
     * edit that changes nothing the audience sees. */
    if (post.status !== ("draft" satisfies LinkedInPostStatus)) return null;
    return { id: post.id, commentary: post.commentary, image: post.image };
  } catch {
    return null;
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: loadIdeaSeed
 *
 * WHAT:  Resolves `?ideaId=` to the saved idea the composer should open with as
 *        its topic, or null.
 * WHY:   Through `postIdeas.get`, so the id is scoped to the caller's organization
 *        and to their own ideas, the same way loadDraftSeed scopes a draft. Every
 *        failure opens a blank composer: a stale link to a deleted idea should
 *        cost the user a link, not the screen.
 */
async function loadIdeaSeed(
  ideaId: string | undefined,
): Promise<PostIdeaSeed | null> {
  if (!ideaId) return null;

  const ctx = await createTRPCContext();
  await ctx.resolveAuth();
  const organization = await ctx.getActiveOrganization();
  if (!organization) return null;

  try {
    const idea = await getQueryClient().fetchQuery(
      trpc.postIdeas.get.queryOptions({
        organizationId: organization.id,
        id: ideaId,
      }),
    );
    return { id: idea.id, text: idea.text };
  } catch {
    return null;
  }
}

export default async function PostGenerationPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string | string[];
    draftId?: string | string[];
    ideaId?: string | string[];
  }>;
}) {
  const { date, draftId, ideaId } = await searchParams;
  const initial = parseInitialDate(Array.isArray(date) ? date[0] : date);
  const draft = await loadDraftSeed(
    Array.isArray(draftId) ? draftId[0] : draftId,
  );
  /* A draft already has its text, so an idea is only read when there is none. */
  const idea = draft
    ? null
    : await loadIdeaSeed(Array.isArray(ideaId) ? ideaId[0] : ideaId);

  return (
    <PostComposer
      imageUploadsEnabled={isImageKitConfigured()}
      aiImageEditsEnabled={isAiImageConfigured()}
      schedulingEnabled={isSchedulerConfigured()}
      {...(initial ? { initialScheduledFor: initial } : {})}
      {...(draft ? { initialDraft: draft } : {})}
      {...(idea ? { initialIdea: idea } : {})}
    />
  );
}
