/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostGenerationPage
 *
 * WHAT:  /dashboard/post-generation route — thin shell; PostComposer does the
 *        work.
 * WHY:   Reads the ImageKit / scheduler config HERE and passes it down, because
 *        those checks read server-only env vars and would silently evaluate to
 *        false inside the client composer — hiding both features on a correctly
 *        configured install. A server component is the only place they can be
 *        answered honestly.
 * WHERE: RESOURCES.linkedinPosts.nav.href.
 */

import type { Metadata } from "next";

import { isImageKitConfigured, isSchedulerConfigured } from "@/lib/config";
import { PostComposer } from "./_components/post-composer";

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

export default async function PostGenerationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const { date } = await searchParams;
  const initial = parseInitialDate(Array.isArray(date) ? date[0] : date);

  return (
    <PostComposer
      imageUploadsEnabled={isImageKitConfigured()}
      schedulingEnabled={isSchedulerConfigured()}
      {...(initial ? { initialScheduledFor: initial } : {})}
    />
  );
}
