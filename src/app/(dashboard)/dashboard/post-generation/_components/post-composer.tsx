/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PostComposer, PostComposerProps,
 *   CALLBACK_ERROR_MESSAGES, toLocalDateTimeInput
 *
 * WHAT:  The Create Post screen — generation controls on the left, a live
 *        LinkedIn preview with an inline editor on the right, and Publish or
 *        Schedule.
 * WHY:   The preview IS the editor: users judge a post by how it will look, so
 *        editing happens inside the same card rather than in a separate
 *        textarea. Publishing is gated on a live connection, which is why the
 *        connect state is read here and not just in the header. OAuth outcomes
 *        arrive as query params (the callback is a redirect, not a fetch), so
 *        they are translated to toasts on mount.
 *
 *        Publish and Schedule are ONE mutation with an optional date, not two
 *        endpoints — that is what keeps a post slot spent exactly once. Images
 *        upload straight to ImageKit, so the form carries a reference rather
 *        than bytes and the old 3 MB payload ceiling is gone.
 * WHERE: Rendered by the post-generation page, which supplies the config flags.
 *        Calls aiGeneration.create, linkedinPosts.create,
 *        linkedinPosts.uploadAuth, and integrations.linkedin.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClockIcon,
  LinkIcon,
  Loader2Icon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { playSound } from "@/lib/sound";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import {
  LINKEDIN_IMAGE_MIME_TYPES,
  LINKEDIN_OAUTH_ERROR_CODES,
  type GeneratePostValues,
  type LinkedInOAuthErrorCode,
  type PostImageValues,
  type PostLength,
  type PostTone,
} from "@/lib/types";
import {
  IMAGEKIT_MAX_IMAGE_BYTES,
  IMAGEKIT_MAX_IMAGE_LABEL,
  LINKEDIN_IMAGE_TRANSFORM,
  LINKEDIN_MAX_COMMENTARY,
  MIN_SCHEDULE_LEAD_MS,
} from "@/lib/config";
import { ContentLayout } from "@/components/global/page-header";
import {
  LinkedInConnectButton,
  LinkedInPostPreview,
} from "@/components/global/linkedin";
import { ImageUpload } from "@/components/global/image-upload";
import { PostStatusBadge } from "@/components/global/post-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GenerateForm } from "./generate-form";

export interface PostComposerProps {
  /** ImageKit is configured — without it, attaching an image is impossible. */
  imageUploadsEnabled: boolean;
  /** A scheduler is wired up — without it, a scheduled post would never fire. */
  schedulingEnabled: boolean;
  /** Preselected day from the calendar's "add post here" action. */
  initialScheduledFor?: Date | undefined;
}

/* The OAuth callback can only talk back through the URL, so each failure mode
 * gets a user-facing sentence here. Typed against LinkedInOAuthErrorCode rather
 * than `string` so adding a code without copy is a compile error instead of a
 * silent fallback to the generic message. */
const CALLBACK_ERROR_MESSAGES: Record<LinkedInOAuthErrorCode, string> = {
  cancelled: "LinkedIn connection cancelled.",
  denied: "LinkedIn denied the connection request.",
  /* Names the actual remedy: this is what LinkedIn returns when the app has no
   * approved products, which looks nothing like a scope problem in its UI. */
  invalid_scope:
    'This LinkedIn app is missing required products. In the LinkedIn developer portal, add "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn".',
  unauthorized_client:
    "This LinkedIn app is not authorized. Check that LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET match the app.",
  server_error:
    "LinkedIn is temporarily unavailable. Please try again in a moment.",
  invalid_state: "That connection link expired. Please try connecting again.",
  exchange_failed:
    "Could not complete the LinkedIn connection. Please try again.",
  not_configured: "LinkedIn is not configured on this deployment.",
};

/* <input type="datetime-local"> speaks `YYYY-MM-DDTHH:mm` in LOCAL time and
 * rejects anything else. toISOString would silently shift the value by the
 * timezone offset, so the user picks 09:00 and the post goes out at 04:00. */
function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/* The earliest value the picker will accept, matching the server's floor so a
 * too-soon time is refused before the round trip rather than after it. */
function earliestSchedule(): string {
  return toLocalDateTimeInput(new Date(Date.now() + MIN_SCHEDULE_LEAD_MS));
}

export function PostComposer({
  imageUploadsEnabled,
  schedulingEnabled,
  initialScheduledFor,
}: PostComposerProps) {
  const organizationId = useActiveOrganizationId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const [commentary, setCommentary] = React.useState("");
  const [tone, setTone] = React.useState<PostTone>("professional");
  const [length, setLength] = React.useState<PostLength>("medium");
  const [image, setImage] = React.useState<PostImageValues | null>(null);
  /* Seeded from the calendar's "add post here" action, so arriving from a day
   * cell lands on the composer with that day already chosen. */
  const [isScheduling, setIsScheduling] = React.useState(
    initialScheduledFor !== undefined,
  );
  /* Computed ONCE at mount, never during render — Date.now() in a render body
   * is impure and produces a value that shifts on every re-render. The floor
   * going slightly stale in a long-lived tab is harmless: the server enforces
   * the real one and returns a readable message. */
  const [minSchedule] = React.useState(earliestSchedule);
  const [scheduledFor, setScheduledFor] = React.useState(() =>
    initialScheduledFor
      ? toLocalDateTimeInput(initialScheduledFor)
      : earliestSchedule(),
  );

  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";

  const connection = trpc.integrations.linkedin.useQuery(
    { organizationId: orgId },
    { enabled },
  );
  const recentPosts = trpc.linkedinPosts.list.useQuery(
    { organizationId: orgId, limit: 5 },
    { enabled },
  );

  /* The callback route redirects here with a result — surface it once, then
   * strip the params so a refresh doesn't replay the toast. */
  React.useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (!connected && !error) return;

    if (connected) {
      toast.success("LinkedIn connected.");
      void utils.integrations.linkedin.invalidate();
    } else if (error) {
      /* The param is attacker-controllable, so it is matched against the known
       * codes rather than used as a bare index — an unknown value falls through
       * to the generic message instead of rendering `undefined`. */
      const code = LINKEDIN_OAUTH_ERROR_CODES.find((known) => known === error);
      toast.error(
        code ? CALLBACK_ERROR_MESSAGES[code] : "Could not connect to LinkedIn.",
      );
    }
    router.replace("/dashboard/post-generation");
  }, [searchParams, router, utils]);

  const generate = trpc.aiGeneration.create.useMutation({
    onSuccess: (result) => {
      setCommentary(result.commentary);
      toast.success("Post generated.");
      /* Silent unless the user opted in. Generation runs long enough that people
         switch tabs while they wait — the cue is what brings them back. */
      playSound("jobComplete");
    },
    onError: (error) => toast.error(error.message),
  });

  const publish = trpc.linkedinPosts.create.useMutation({
    onSuccess: async (post) => {
      toast.success(
        post.status === "scheduled"
          ? `Scheduled for ${post.scheduledFor?.toLocaleString() ?? "later"}.`
          : "Published to LinkedIn.",
      );
      setCommentary("");
      setImage(null);
      setIsScheduling(false);
      setScheduledFor(earliestSchedule());
      await Promise.all([
        utils.linkedinPosts.list.invalidate(),
        utils.linkedinPosts.listCalendar.invalidate(),
        utils.usage.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  /* Opted OUT of the app-wide 30s staleTime (see src/trpc/tanstack-config.ts):
   * `.fetch()` is fetchQuery, so a fresh cache entry is returned WITHOUT a round
   * trip — and ImageKit burns an upload token on first use, so the second image
   * within the window would replay a spent token and fail at the vendor.
   * staleTime 0 forces the round trip; gcTime 0 stops a signed credential from
   * lingering in the client cache after it is used. */
  async function fetchUploadAuth() {
    return utils.linkedinPosts.uploadAuth.fetch(
      { organizationId: orgId },
      { staleTime: 0, gcTime: 0 },
    );
  }

  function handleGenerate(values: GeneratePostValues) {
    if (!enabled) return;
    generate.mutate({ ...values, organizationId: orgId });
  }

  function handleSubmit() {
    if (!enabled) return;
    publish.mutate({
      organizationId: orgId,
      commentary,
      ...(image ? { image } : {}),
      /* The ONLY difference between publishing and scheduling. The server
       * branches on this field; the quota is spent either way. */
      ...(isScheduling ? { scheduledFor: new Date(scheduledFor) } : {}),
    });
  }

  /* What LinkedIn will actually receive — the same transform the publish path
   * applies, so the preview cannot flatter the result. */
  const imagePreviewUrl = image
    ? `${image.url}?tr=${image.transform ?? LINKEDIN_IMAGE_TRANSFORM}`
    : null;

  const isConnected =
    Boolean(connection.data?.connected) && !connection.data?.needsReconnect;
  /* `YYYY-MM-DDTHH:mm` sorts lexicographically in chronological order, so a
   * string compare against the mount-time floor is both correct and pure. */
  const scheduleIsValid =
    !isScheduling || (scheduledFor.length > 0 && scheduledFor >= minSchedule);
  const canPublish =
    isConnected &&
    commentary.trim().length > 0 &&
    commentary.length <= LINKEDIN_MAX_COMMENTARY &&
    scheduleIsValid;

  return (
    <ContentLayout
      title="Create Post"
      description="Generate a draft, edit it in place, publish or schedule"
      icon={<SparklesIcon className="size-4" />}
      actions={<LinkedInConnectButton />}
    >
      {/* items-start: both columns start at the top of the row. Without it a
          short controls card and a tall preview column can disagree about where
          the row begins, which reads as one card sitting lower than the other. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* NOT sticky: `.surface-raised` sets `position: relative` so its
            top-edge ::before has something to anchor to, and a second `position`
            on the same element is a coin toss between the two utilities. If this
            column should pin while the preview scrolls, the sticky belongs on a
            plain wrapper around the card, not on the card itself. */}
        <Card className="surface-raised h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
                <SparklesIcon className="size-4" />
              </span>
              What should we write about?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GenerateForm
              tone={tone}
              length={length}
              onToneChange={setTone}
              onLengthChange={setLength}
              onGenerate={handleGenerate}
              isGenerating={generate.isPending}
              disabled={!enabled}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <LinkedInPostPreview
            authorName={connection.data?.name ?? "Your name"}
            authorAvatarUrl={connection.data?.avatarUrl}
            commentary={commentary}
            imageUrl={imagePreviewUrl}
            actions={
              imageUploadsEnabled ? (
                <ImageUpload
                  value={image}
                  onChange={setImage}
                  getAuthParams={fetchUploadAuth}
                  accept={LINKEDIN_IMAGE_MIME_TYPES}
                  maxBytes={IMAGEKIT_MAX_IMAGE_BYTES}
                  maxBytesLabel={IMAGEKIT_MAX_IMAGE_LABEL}
                  disabled={publish.isPending || !enabled}
                />
              ) : null
            }
          >
            {/* The editor replaces the preview body so what you type is
                literally what the post will look like. */}
            <Textarea
              value={commentary}
              onChange={(event) => setCommentary(event.target.value)}
              placeholder="Your AI generated post will be shown here..."
              rows={10}
              disabled={generate.isPending}
              className="resize-none border-0 p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
            />
          </LinkedInPostPreview>

          {/* Moved ABOVE the action row: this is the reason the publish button
              is disabled, and it used to sit underneath it — the reader hit the
              dead button first and the explanation second. */}
          {!isConnected ? (
            /* Tinted rather than destructive: nothing is broken, publishing is
               just the one thing still gated. */
            <div className="flex items-start gap-2 rounded-lg border border-brand-border bg-brand-soft p-3">
              <LinkIcon className="mt-0.5 size-4 shrink-0 text-brand-soft-foreground" />
              <p className="text-sm text-brand-soft-foreground">
                Connect your LinkedIn account to publish. You can still generate
                and edit copy without one.
              </p>
            </div>
          ) : null}

          {schedulingEnabled ? (
            <div className="surface-raised flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="schedule-toggle"
                  checked={isScheduling}
                  onCheckedChange={setIsScheduling}
                  disabled={publish.isPending}
                />
                <label
                  htmlFor="schedule-toggle"
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <CalendarClockIcon className="size-4 text-muted-foreground" />
                  Schedule for later
                </label>
              </div>
              {isScheduling ? (
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  /* Mirrors the server's floor so a too-soon time is refused by
                     the picker instead of by a round trip. */
                  min={minSchedule}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  disabled={publish.isPending}
                  className="w-auto"
                />
              ) : null}
              {isScheduling && !scheduleIsValid ? (
                <p className="text-sm text-destructive">
                  Pick a time at least {MIN_SCHEDULE_LEAD_MS / 60_000} minutes
                  from now.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* The commit row, given its own surface so the primary action reads
              as the end of the composer rather than another line of text. */}
          <div className="surface-raised flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <p
                className={
                  commentary.length > LINKEDIN_MAX_COMMENTARY
                    ? "text-sm tabular-nums text-destructive"
                    : "text-sm tabular-nums text-muted-foreground"
                }
              >
                {commentary.length} / {LINKEDIN_MAX_COMMENTARY} characters
              </p>
              {/* A bar as well as the count: at 3,000 the number alone gives no
                  sense of how much room is left until it is already gone. */}
              <div
                aria-hidden="true"
                className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={
                    commentary.length > LINKEDIN_MAX_COMMENTARY
                      ? "h-full rounded-full bg-destructive transition-all"
                      : "h-full rounded-full bg-brand transition-all"
                  }
                  style={{
                    width: `${Math.min(100, (commentary.length / LINKEDIN_MAX_COMMENTARY) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <Button
              variant="brand"
              onClick={handleSubmit}
              disabled={!canPublish || publish.isPending}
            >
              {publish.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : isScheduling ? (
                <CalendarClockIcon className="size-4" />
              ) : (
                <SendIcon className="size-4" />
              )}
              {isScheduling ? "Schedule post" : "Post to LinkedIn"}
            </Button>
          </div>

          {recentPosts.data && recentPosts.data.length > 0 ? (
            <Card className="surface-raised">
              <CardHeader>
                <CardTitle className="text-base">Recent posts</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {recentPosts.data.map((post, index) => (
                  <React.Fragment key={post.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        {/* The same chip the calendar and dashboard use, so a
                            post's state looks identical wherever it appears. */}
                        <PostStatusBadge status={post.status} />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {/* Nullable since scheduling landed, though this list
                              only ever holds published rows. */}
                          {post.publishedAt?.toLocaleString() ?? "—"}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {post.commentary}
                      </p>
                    </div>
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </ContentLayout>
  );
}
