/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedInConnectButton, LINKEDIN_CONNECT_PATH
 *
 * WHAT:  Renders the LinkedIn connection state and the action that changes it —
 *        Connect, Reconnect, or Disconnect.
 * WHY:   Global because every LinkedIn surface needs the same control, and
 *        because the four states (unconfigured / disconnected / expired /
 *        connected) are easy to render inconsistently if each page reimplements
 *        them. Connecting is a full-page navigation, not a fetch: the OAuth
 *        handshake must set an httpOnly state cookie and hand the browser to
 *        LinkedIn.
 * WHERE: Rendered in the composer header. Reads integrations.linkedin; writes
 *        via integrations.disconnect.
 */

import * as React from "react";
import { Loader2Icon, LinkIcon, UnlinkIcon } from "lucide-react";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* Starting the handshake is a navigation, not an API call — the connect route
 * needs to set an httpOnly cookie and 302 the browser to LinkedIn. */
export const LINKEDIN_CONNECT_PATH = "/api/linkedin/connect";

export function LinkedInConnectButton() {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();
  const enabled = organizationId !== undefined;

  const connection = trpc.integrations.linkedin.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled },
  );

  const disconnect = trpc.integrations.disconnect.useMutation({
    onSuccess: async () => {
      await utils.integrations.linkedin.invalidate();
    },
  });

  if (connection.isLoading || !enabled) {
    return <Skeleton className="h-9 w-40" />;
  }

  const status = connection.data;
  if (!status) return null;

  /* Operator hasn't set the OAuth credentials — a Connect button here would
   * bounce the user to a LinkedIn error page, so disable it and say why. */
  if (!status.configured) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        LinkedIn not configured
      </Badge>
    );
  }

  if (!status.connected || status.needsReconnect) {
    return (
      <Button
        size="sm"
        variant="brand"
        /* A full-page navigation, not a fetch: the connect route sets an
         * httpOnly state cookie and 302s the browser to LinkedIn's consent
         * screen, neither of which survives a client-side transition. */
        onClick={() => {
          window.location.href = LINKEDIN_CONNECT_PATH;
        }}
      >
        <LinkIcon className="size-4" />
        {status.needsReconnect ? "Reconnect LinkedIn" : "Connect LinkedIn"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Tinted pill: the accent is what tells you the channel is live, so the
          connected identity carries it rather than a separate status label. */}
      <div
        data-slot="linkedin-identity"
        className="flex items-center gap-2 rounded-full border border-brand-border bg-brand-soft py-1 pr-3 pl-1"
      >
        <Avatar className="size-6">
          {status.avatarUrl ? (
            <AvatarImage src={status.avatarUrl} alt={status.name ?? ""} />
          ) : null}
          <AvatarFallback className="bg-brand text-xs text-brand-foreground">
            {status.name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-32 truncate text-sm font-medium text-brand-soft-foreground">
          {status.name}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={disconnect.isPending}
        onClick={() =>
          disconnect.mutate({
            organizationId: organizationId ?? "",
            provider: "linkedin",
          })
        }
      >
        {disconnect.isPending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <UnlinkIcon className="size-4" />
        )}
        Disconnect
      </Button>
    </div>
  );
}
