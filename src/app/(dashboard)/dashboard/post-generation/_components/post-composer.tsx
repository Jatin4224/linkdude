/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PostComposer, PostComposerProps,
 *   CALLBACK_ERROR_MESSAGES, toLocalDateTimeInput, handleSaveDraft, draftId,
 *   handleFix, handleUndoFix, PostCheckPanel, preFixCommentary, goal,
 *   openingChoices, handleChooseOpening, HookOpenings
 *
 * WHAT:  The Create Post screen — generation controls on the left, a live
 *        LinkedIn preview with an inline editor on the right, and Save draft,
 *        Publish or Schedule.
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
 *
 *        Saving a draft is a DIFFERENT verb, and that is equally load-bearing:
 *        `linkedinPosts.draft` spends no post slot, needs no LinkedIn
 *        connection, and returns an id this screen then promotes on publish.
 * WHERE: Rendered by the post-generation page, which supplies the config flags
 *        and the `?draftId=` to reopen. Calls aiGeneration.create,
 *        linkedinPosts.create, linkedinPosts.draft, linkedinPosts.get,
 *        linkedinPosts.uploadAuth, integrations.linkedin, and voiceProfile.get.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClockIcon,
  LinkIcon,
  Loader2Icon,
  SaveIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import { playSound } from "@/lib/sound";
import { permissions } from "@/lib/better-auth/permissions";

import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import {
  DEFAULT_POST_GOAL,
  DEFAULT_POST_LENGTH,
  DEFAULT_POST_TONE,
  LINKEDIN_IMAGE_MIME_TYPES,
  LINKEDIN_OAUTH_ERROR_CODES,
  type GeneratePostValues,
  type LinkedInOAuthErrorCode,
  type PostCheckCode,
  type PostGoal,
  type PostImageValues,
  type PostLength,
  type PostOpeningChoice,
  type PostTone,
} from "@/lib/types";
import {
  readOpeningLine,
  replaceOpeningLine,
  buildTransformedUrl,
  IMAGEKIT_MAX_IMAGE_BYTES,
  IMAGEKIT_MAX_IMAGE_LABEL,
  LINKEDIN_IMAGE_TRANSFORM,
  LINKEDIN_MAX_COMMENTARY,
  MIN_SCHEDULE_LEAD_MS,
} from "@/lib/config";
import { earliestSchedule, toLocalDateTimeInput } from "@/lib/utils";
import { ContentLayout } from "@/components/global/page-header";
import {
  LinkedInConnectButton,
  LinkedInPostPreview,
} from "@/components/global/linkedin";
import { ImageUpload } from "@/components/global/image-upload";
import { ImageEditor } from "@/components/global/image-editor";
import { AiImageEdit } from "@/components/global/ai-image-edit";
import { PostStatusBadge } from "@/components/global/post-status-badge";
import { PostCheckPanel } from "@/components/global/post-check";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GenerateForm } from "./generate-form";
import { HookOpenings } from "./hook-openings";

export interface PostComposerProps {
  /** ImageKit is configured — without it, attaching an image is impossible. */
  imageUploadsEnabled: boolean;
  /** The active AI vendor has an image model AND a key. Not every one does. */
  aiImageEditsEnabled: boolean;
  /** A scheduler is wired up — without it, a scheduled post would never fire. */
  schedulingEnabled: boolean;
  /** Preselected day from the calendar's "add post here" action. */
  initialScheduledFor?: Date | undefined;
  /** A draft to reopen, resolved server-side from `?draftId=`. */
  initialDraft?: PostDraftSeed | undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PostDraftSeed
 *
 * WHAT:  The values a reopened draft opens the composer with.
 * WHY:   A prop rather than a client fetch, so the text and image are the form's
 *        INITIAL state. Seeding them after mount would mean an effect that fires
 *        on every refetch and overwrites what the user has typed since.
 *
 *        `image` is the same PostImageValues the publish path sends back —
 *        rebuilt server-side by getPostForEdit — so a reopened draft keeps its
 *        picture, transform and AI-edit history intact.
 * WHERE: Produced by loadDraftSeed in the post-generation page.
 */
export interface PostDraftSeed {
  id: string;
  commentary: string;
  image: PostImageValues | null;
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

/* toLocalDateTimeInput / earliestSchedule moved to @/lib/utils — the carousel
 * publish dialog schedules too, and a second copy of a timezone-sensitive
 * formatter is how the two surfaces would quietly disagree. */

export function PostComposer({
  imageUploadsEnabled,
  aiImageEditsEnabled,
  schedulingEnabled,
  initialScheduledFor,
  initialDraft,
}: PostComposerProps) {
  const organizationId = useActiveOrganizationId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  /* Seeded from the reopened draft, which arrives already resolved — see
   * PostDraftSeed. A blank composer is just the no-draft case of the same code. */
  const [commentary, setCommentary] = React.useState(
    initialDraft?.commentary ?? "",
  );
  const [tone, setTone] = React.useState<PostTone>(DEFAULT_POST_TONE);
  const [length, setLength] = React.useState<PostLength>(DEFAULT_POST_LENGTH);
  const [goal, setGoal] = React.useState<PostGoal>(DEFAULT_POST_GOAL);
  const [image, setImage] = React.useState<PostImageValues | null>(
    initialDraft?.image ?? null,
  );
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
  /* The draft this session is editing, if any. Held in state rather than read
   * from the URL each render because pressing Save on a NEW post adopts the id
   * the server just minted — every later save then updates that row instead of
   * littering the library with copies. */
  const [draftId, setDraftId] = React.useState<string | null>(
    initialDraft?.id ?? null,
  );

  /* The text a Fix it replaced, so Undo fix can put the member's own wording
   * back. Cleared as soon as they type, generate or publish, so an undo never
   * throws away edits made after the fix. */
  const [preFixCommentary, setPreFixCommentary] = React.useState<
    string | null
  >(null);
  /* The length the current post was GENERATED at. The length select defaults to
   * Medium, so checking a hand-written or reopened post against it would warn on
   * every short post; the check only has a real target after a generation. */
  const [targetLength, setTargetLength] = React.useState<PostLength | null>(
    null,
  );
  /* The generated opening plus its alternatives, offered until the next
   * generation or publish. Empty when a generation returned none (blog posts). */
  const [openingChoices, setOpeningChoices] = React.useState<
    PostOpeningChoice[]
  >([]);

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
  /* Asked only when the member may read voice profiles, so a role without that
   * grant sees no voice line rather than a failed request. */
  const { hasPermission } = useActiveOrganization();
  const canReadVoice = hasPermission(permissions.VOICE_PROFILE_READ);
  const voiceProfile = trpc.voiceProfile.get.useQuery(
    { organizationId: orgId },
    { enabled: enabled && canReadVoice, retry: false },
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
    /* Strips the callback params without dropping the draft: someone who
       connects LinkedIn mid-edit comes back to the post they were writing. */
    const draftParam = searchParams.get("draftId");
    router.replace(
      draftParam
        ? `/dashboard/post-generation?draftId=${encodeURIComponent(draftParam)}`
        : "/dashboard/post-generation",
    );
  }, [searchParams, router, utils]);

  const generate = trpc.aiGeneration.create.useMutation({
    onSuccess: (result, variables) => {
      setCommentary(result.commentary);
      setPreFixCommentary(null);
      setTargetLength(variables.length);
      /* The generated opening goes first, so it can always be chosen again. */
      setOpeningChoices(
        result.alternativeOpenings.length > 0
          ? [
              {
                formula: result.formula,
                line: readOpeningLine(result.commentary),
              },
              ...result.alternativeOpenings,
            ]
          : [],
      );
      toast.success("Post generated.");
      /* Silent unless the user opted in. Generation runs long enough that people
         switch tabs while they wait — the cue is what brings them back. */
      playSound("jobComplete");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  /* Fix it is the same procedure as Generate with source "fix", so it spends one
   * generation from the same allowance. Its own mutation instance, so fixing
   * and generating show separate spinners. */
  const fixPost = trpc.aiGeneration.create.useMutation({
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const publish = trpc.linkedinPosts.create.useMutation({
    onSuccess: async (post) => {
      toast.success(
        post.status === "scheduled"
          ? `Scheduled for ${post.scheduledFor?.toLocaleString() ?? "later"}.`
          : "Published to LinkedIn.",
      );
      setCommentary("");
      setPreFixCommentary(null);
      setTargetLength(null);
      setOpeningChoices([]);
      setImage(null);
      setIsScheduling(false);
      setScheduledFor(earliestSchedule());
      /* The draft was PROMOTED, not copied — the row that was a draft is now the
       * published post. Clearing the id (and the URL param) stops the next Save
       * from trying to edit a post that has already gone out. */
      if (draftId) {
        setDraftId(null);
        router.replace("/dashboard/post-generation");
      }
      await Promise.all([
        utils.linkedinPosts.list.invalidate(),
        utils.linkedinPosts.listLibrary.invalidate(),
        utils.linkedinPosts.listCalendar.invalidate(),
        utils.usage.invalidate(),
      ]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  /* Saving spends NO post slot — see linkedinPosts.draft. Usage is deliberately
   * NOT invalidated here: nothing moved, and refetching it would suggest it had. */
  const saveDraft = trpc.linkedinPosts.draft.useMutation({
    onSuccess: async (saved) => {
      setDraftId(saved.id);
      /* Reflected into the URL so a refresh reopens the same draft rather than a
       * blank composer, matching how `?date=` already seeds this screen. A
       * `replace`, not a `push`: saving twice must not stack two history entries
       * the user has to press Back through. */
      router.replace(
        `/dashboard/post-generation?draftId=${encodeURIComponent(saved.id)}`,
      );
      toast.success("Draft saved.");
      await utils.linkedinPosts.listLibrary.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
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

  const editImage = trpc.aiImageEdit.create.useMutation();

  /* Passed to the dialog rather than the dialog calling tRPC itself, so that
   * component stays as generic as its image-upload sibling. Usage is
   * invalidated because an edit spends a metered generation. */
  async function generateImageEdit(prompt: string): Promise<PostImageValues> {
    if (!image) throw new Error("Attach an image first.");
    const edited = await editImage.mutateAsync({
      organizationId: orgId,
      image,
      prompt,
    });
    await utils.usage.invalidate();
    return edited;
  }

  function handleGenerate(values: GeneratePostValues) {
    if (!enabled) return;
    generate.mutate({ ...values, organizationId: orgId });
  }

  /* Sends the codes the check found, never free text: the wording of each
   * problem is added on the server from POST_CHECK_RULES. */
  function handleFix(issues: PostCheckCode[]) {
    if (!enabled) return;
    const original = commentary;
    fixPost.mutate(
      {
        source: "fix",
        commentary: original,
        issues,
        tone,
        length: targetLength ?? length,
        organizationId: orgId,
      },
      {
        onSuccess: async (result) => {
          setPreFixCommentary(original);
          setCommentary(result.commentary);
          toast.success("Fixed. Read it once to check it still sounds like you.");
          await utils.usage.invalidate();
        },
      },
    );
  }

  /* Swaps only the first line, so edits below it survive. An earlier fix can no
   * longer be undone cleanly once the opening changes, so its undo is dropped. */
  function handleChooseOpening(line: string) {
    setCommentary((current) => replaceOpeningLine(current, line));
    setPreFixCommentary(null);
  }

  function handleUndoFix() {
    if (preFixCommentary === null) return;
    setCommentary(preFixCommentary);
    setPreFixCommentary(null);
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
      /* Tells the server to promote the draft row rather than insert a second
       * one, so the library does not end up holding both. */
      ...(draftId ? { draftId } : {}),
    });
  }

  function handleSaveDraft() {
    if (!enabled) return;
    saveDraft.mutate({
      organizationId: orgId,
      commentary,
      ...(image ? { image } : {}),
      /* Absent on the first save, present on every one after — the server
       * creates or updates on exactly that distinction. */
      ...(draftId ? { postId: draftId } : {}),
    });
  }

  /* What LinkedIn will actually receive — built by the SAME function the publish
   * path uses, not a hand-rolled template, so the preview cannot flatter the
   * result by encoding the URL even slightly differently. */
  const imagePreviewUrl = image
    ? buildTransformedUrl(
        image.url,
        image.transform ?? LINKEDIN_IMAGE_TRANSFORM,
      )
    : null;

  const isConnected =
    Boolean(connection.data?.connected) && !connection.data?.needsReconnect;
  /* `YYYY-MM-DDTHH:mm` sorts lexicographically in chronological order, so a
   * string compare against the mount-time floor is both correct and pure. */
  const scheduleIsValid =
    !isScheduling || (scheduledFor.length > 0 && scheduledFor >= minSchedule);
  const withinLimit =
    commentary.trim().length > 0 && commentary.length <= LINKEDIN_MAX_COMMENTARY;
  const canPublish = isConnected && withinLimit && scheduleIsValid;
  /* No connection and no schedule requirement — a draft is ours, not LinkedIn's,
   * and it has no date to validate. */
  const canSaveDraft = enabled && withinLimit;
  /* `undefined` hides the voice line until there is a real answer to show. A
   * voice that no longer parses counts as off, matching what the server sends
   * the model. */
  const voiceActive =
    canReadVoice && voiceProfile.data !== undefined
      ? Boolean(voiceProfile.data?.isActive && voiceProfile.data.current)
      : undefined;

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
              goal={goal}
              onGoalChange={setGoal}
              onGenerate={handleGenerate}
              isGenerating={generate.isPending}
              disabled={!enabled}
              voiceActive={voiceActive}
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
                <div className="flex flex-wrap items-center gap-2">
                  <ImageUpload
                    value={image}
                    onChange={setImage}
                    getAuthParams={fetchUploadAuth}
                    accept={LINKEDIN_IMAGE_MIME_TYPES}
                    maxBytes={IMAGEKIT_MAX_IMAGE_BYTES}
                    maxBytesLabel={IMAGEKIT_MAX_IMAGE_LABEL}
                    disabled={publish.isPending || !enabled}
                  />
                  {/* Only with an image attached: an editor over nothing has
                      no subject, and a disabled button would just ask the
                      reader to work out why. */}
                  {image ? (
                    <ImageEditor
                      value={image}
                      onChange={setImage}
                      disabled={publish.isPending || !enabled}
                    />
                  ) : null}
                  {image && aiImageEditsEnabled ? (
                    <AiImageEdit
                      value={image}
                      onChange={setImage}
                      onGenerate={generateImageEdit}
                      disabled={publish.isPending || !enabled}
                    />
                  ) : null}
                </div>
              ) : null
            }
          >
            {/* The editor replaces the preview body so what you type is
                literally what the post will look like. */}
            <Textarea
              value={commentary}
              onChange={(event) => {
                setCommentary(event.target.value);
                setPreFixCommentary(null);
              }}
              placeholder="Your AI generated post will be shown here..."
              rows={10}
              disabled={generate.isPending || fixPost.isPending}
              className="resize-none border-0 p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
            />
          </LinkedInPostPreview>

          {openingChoices.length > 0 && commentary.trim() ? (
            <HookOpenings
              choices={openingChoices}
              currentOpening={readOpeningLine(commentary)}
              onChoose={handleChooseOpening}
              disabled={generate.isPending || fixPost.isPending}
            />
          ) : null}

          {/* Right under the editor, so a flagged line is next to the text it is
              about. Checks as the member types; Fix it spends a generation. */}
          <PostCheckPanel
            commentary={commentary}
            length={targetLength ?? undefined}
            onFix={handleFix}
            fixResource="aiGeneration"
            isFixing={fixPost.isPending}
            onUndoFix={preFixCommentary !== null ? handleUndoFix : undefined}
            disabled={!enabled || generate.isPending}
          />

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
            <div className="flex items-center gap-2">
              {/* NOT gated on `isConnected`, unlike Publish beside it: saving
                  touches only our own database, and a user who has not connected
                  LinkedIn yet must still be able to keep what they wrote. */}
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={!canSaveDraft || saveDraft.isPending}
              >
                {saveDraft.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                {draftId ? "Save draft" : "Save as draft"}
              </Button>
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
