/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PublishDialog, PublishDialogProps
 *
 * WHAT:  Publishes a rendered carousel to LinkedIn as a document post — the
 *        commentary that sits above the deck, and an optional schedule.
 * WHY:   Calls `linkedinPosts.create`, NOT a carousel verb of its own. That is
 *        load-bearing: only `<resource>.create` spends a quota slot, so routing
 *        a deck through the post resource means one post costs one post — and it
 *        inherits scheduling, the publish worker, the calendar and delete without
 *        a second code path. A `carousel.publish` verb would either double-meter
 *        or bypass the post limit entirely.
 *
 *        Only the document ID crosses the wire. The url, filename and page count
 *        are read server-side from the Document row, so a client cannot point a
 *        post at a file its organization does not own.
 * WHERE: Opened from the slide editor once a deck has rendered.
 */

import * as React from "react";
import { Loader2Icon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { LINKEDIN_MAX_COMMENTARY, MIN_SCHEDULE_LEAD_MS } from "@/lib/config";
import { cn, earliestSchedule } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LinkedInConnectButton } from "@/components/global/linkedin";

export interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  /** Seeds the commentary box so the user edits rather than starts blank. */
  defaultCommentary?: string | undefined;
  onPublished: () => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  documentId,
  defaultCommentary,
  onPublished,
}: PublishDialogProps) {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const [commentary, setCommentary] = React.useState(defaultCommentary ?? "");
  const [isScheduled, setIsScheduled] = React.useState(false);
  /* Both computed ONCE at mount, never during render — Date.now() in a render
   * body is impure, produces a value that shifts on every re-render, and the
   * React Compiler rejects it. A floor going slightly stale in a long-lived tab
   * is harmless: the server enforces the real one. Same approach as the post
   * composer. */
  const [minSchedule] = React.useState(earliestSchedule);
  const [scheduledFor, setScheduledFor] = React.useState(earliestSchedule);

  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";

  const connection = trpc.integrations.linkedin.useQuery(
    { organizationId: orgId },
    { enabled: enabled && open },
  );

  const publish = trpc.linkedinPosts.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.linkedinPosts.list.invalidate(),
        utils.linkedinPosts.listCalendar.invalidate(),
      ]);
      onOpenChange(false);
      onPublished();
      toast.success(
        isScheduled ? "Carousel scheduled." : "Carousel published to LinkedIn.",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  /* `needsReconnect` matters as much as `connected`: an expired token reports
   * connected but cannot publish. Matches the composer's check exactly. */
  const isConnected =
    Boolean(connection.data?.connected) && !connection.data?.needsReconnect;
  const overLimit = commentary.length > LINKEDIN_MAX_COMMENTARY;

  /* `YYYY-MM-DDTHH:mm` sorts lexicographically in chronological order, so a
   * string compare against the mount-time floor is both correct and pure. */
  const scheduleIsValid =
    !isScheduled || (scheduledFor.length > 0 && scheduledFor >= minSchedule);

  const canPublish =
    isConnected &&
    commentary.trim().length > 0 &&
    !overLimit &&
    scheduleIsValid &&
    !publish.isPending;

  function submit() {
    publish.mutate({
      organizationId: orgId,
      commentary: commentary.trim(),
      documentId,
      ...(isScheduled && scheduledFor
        ? { scheduledFor: new Date(scheduledFor) }
        : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish carousel</DialogTitle>
          <DialogDescription>
            LinkedIn shows this as a swipeable document post. Your commentary
            sits above the deck.
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          <div className="flex flex-col items-start gap-3 rounded-md border p-4">
            <p className="text-sm text-muted-foreground">
              Connect a LinkedIn account to publish this carousel.
            </p>
            <LinkedInConnectButton />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carousel-commentary">Commentary</Label>
              <Textarea
                id="carousel-commentary"
                value={commentary}
                onChange={(event) => setCommentary(event.target.value)}
                rows={5}
                placeholder="What should people read before they swipe?"
                className={cn(overLimit && "border-destructive")}
              />
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  overLimit && "text-destructive",
                )}
              >
                {commentary.length} / {LINKEDIN_MAX_COMMENTARY}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="carousel-schedule">Schedule for later</Label>
              <Switch
                id="carousel-schedule"
                checked={isScheduled}
                onCheckedChange={setIsScheduled}
              />
            </div>

            {isScheduled ? (
              <div className="flex flex-col gap-1.5">
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  min={minSchedule}
                  onChange={(event) => setScheduledFor(event.target.value)}
                />
                {!scheduleIsValid ? (
                  <span className="text-xs text-destructive">
                    Pick a time at least{" "}
                    {Math.round(MIN_SCHEDULE_LEAD_MS / 60_000)} minutes from now.
                  </span>
                ) : null}
              </div>
            ) : null}

            <Button
              variant="brand"
              onClick={submit}
              disabled={!canPublish}
              className="w-full"
            >
              {publish.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
              {isScheduled ? "Schedule carousel" : "Publish now"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
