/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: VoiceStatusLine, VoiceStatusLineProps, voice
 *   status, drafts written in your voice, voiceProfile.get
 *
 * WHAT:  One line telling the member whether AI drafts will be written in their
 *        voice, with a link to manage it or set it up.
 * WHY:   Every generator reads the voice on the server, which makes it invisible
 *        state. Showing it next to a Generate button tells the member what they
 *        are about to get. It started inside the post composer and was lifted
 *        here when the job email writer needed the same line, so both screens
 *        say the same words.
 *
 *        Self-contained on purpose: it checks the permission and reads the
 *        profile itself, so a screen only has to render it.
 * WHERE: The post composer's generate form and the Job Assist form.
 */

import Link from "next/link";
import { AudioLinesIcon } from "lucide-react";

import { permissions } from "@/lib/better-auth/permissions";
import { RESOURCES } from "@/lib/resources";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";

export interface VoiceStatusLineProps {
  className?: string | undefined;
}

export function VoiceStatusLine({ className }: VoiceStatusLineProps) {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();
  const canRead = hasPermission(permissions.VOICE_PROFILE_READ);

  /* Asked only with the permission, so a restricted role sees no line rather
   * than a failed request. */
  const profileQuery = trpc.voiceProfile.get.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: organizationId !== undefined && canRead, retry: false },
  );

  /* Hidden until there is a real answer to show. */
  if (!canRead || profileQuery.data === undefined) return null;

  /* A voice that no longer parses counts as off, matching what the server
   * actually sends the model. */
  const isActive = Boolean(
    profileQuery.data?.isActive && profileQuery.data.current,
  );

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <AudioLinesIcon className="size-3.5 shrink-0" />
      <span>
        {isActive
          ? "Drafts are written in your voice."
          : "Drafts use the default style."}
      </span>
      <Link
        href={RESOURCES.voiceProfile.nav.href}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {isActive ? "Manage" : "Set up your voice"}
      </Link>
    </p>
  );
}
